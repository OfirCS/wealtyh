// Reads receipts and bank alerts straight from the user's Gmail, in the browser.
// The access token never leaves this page and nothing is stored on a server.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCOPE = 'openid email profile https://www.googleapis.com/auth/gmail.readonly';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const STORAGE_KEY = 'pathfinder.gmail.v1';

/** How far back the first look goes. */
const FIRST_LOOK_DAYS = 90;
const MAX_EMAILS = 150;
const MAX_EMAIL_LENGTH = 1800;
const PARALLEL_READS = 8;

// What a purchase email tends to say, in English and French
const RECEIPT_SEARCH = [
  'receipt', '"order confirmation"', '"your order"', 'invoice', '"payment received"',
  '"transaction alert"', '"purchase alert"', '"you made a purchase"', '"e-transfer"', '"thank you for your purchase"',
  'reçu', '"confirmation de commande"', 'facture',
].join(' OR ');

export const GMAIL_READY = Boolean(CLIENT_ID);

export class GmailError extends Error {}

interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

function loadGoogleScript(): Promise<void> {
  if (window.google) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = () => reject(new GmailError("I couldn't reach Google. Check your connection and try again."));
    document.head.append(script);
  });
}

/** Opens Google's own sign-in window. Pathfinder never sees the password. */
export async function requestGmailAccess(): Promise<string> {
  if (!CLIENT_ID) throw new GmailError('Gmail needs one setup step first.');
  await loadGoogleScript();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new GmailError("Google didn't give me access, so nothing was read."));
      },
      error_callback: () => reject(new GmailError('The Google window closed before you finished. No problem, try again when you like.')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function gmail<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new GmailError("I couldn't read your email just now. Try again in a moment.");
  return response.json() as Promise<T>;
}

/** Who just signed in, so the app can greet them by name. */
export async function fetchGoogleUser(token: string): Promise<{ name: string; email: string }> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    const user = await response.json() as { given_name?: string; name?: string; email?: string };
    return { name: user.given_name ?? user.name ?? '', email: user.email ?? '' };
  } catch {
    return { name: '', email: '' };
  }
}

export function lastGmailCheck(): number | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  } catch {
    return null;
  }
}

export function rememberGmailCheck(time: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(time));
  } catch {
    // Ignore storage failures (private mode/quota)
  }
}

export function forgetGmail(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures (private mode/quota)
  }
}

/** Finds emails that look like purchases, skipping promotions. */
export async function findReceiptEmails(token: string, since: number | null): Promise<string[]> {
  const after = since ? `after:${Math.floor(since / 1000)}` : `newer_than:${FIRST_LOOK_DAYS}d`;
  const query = encodeURIComponent(`(${RECEIPT_SEARCH}) ${after} -category:promotions -category:social`);
  const ids: string[] = [];
  let pageToken = '';

  while (ids.length < MAX_EMAILS) {
    const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(
      token,
      `messages?q=${query}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`,
    );
    ids.push(...(page.messages ?? []).map((message) => message.id));
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  return ids.slice(0, MAX_EMAILS);
}

interface EmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: EmailPart[];
}

interface EmailMessage {
  internalDate?: string;
  snippet?: string;
  payload?: EmailPart & { headers?: { name: string; value: string }[] };
}

function decode(data: string): string {
  const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function findPart(part: EmailPart | undefined, mimeType: string): string | null {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return decode(part.body.data);
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

/** Keeps only the words, so each email costs little to read. */
export function emailToText(message: EmailMessage): string {
  const headers = message.payload?.headers ?? [];
  const header = (name: string) => headers.find((item) => item.name.toLowerCase() === name)?.value ?? '';
  const html = findPart(message.payload, 'text/html');
  const body = findPart(message.payload, 'text/plain')
    ?? html?.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    ?? message.snippet
    ?? '';
  const date = message.internalDate ? new Date(Number(message.internalDate)).toISOString().slice(0, 10) : '';
  return `From: ${header('from')}\nDate: ${date}\nSubject: ${header('subject')}\n${body.replace(/\s+/g, ' ').trim().slice(0, MAX_EMAIL_LENGTH)}`;
}

/** Reads a few at a time, reporting progress so the agent can show its work. */
export async function readEmails(token: string, ids: string[], onProgress: (done: number) => void): Promise<string[]> {
  const texts: string[] = [];
  for (let start = 0; start < ids.length; start += PARALLEL_READS) {
    const batch = ids.slice(start, start + PARALLEL_READS);
    const messages = await Promise.all(batch.map((id) => gmail<EmailMessage>(token, `messages/${id}?format=full`)));
    texts.push(...messages.map(emailToText));
    onProgress(texts.length);
  }
  return texts;
}

// Reads receipts and bank alerts straight from the user's Gmail, in the browser.
// The access token never leaves this page and nothing is stored on a server.

import type { StatementRow } from './statement';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const SCOPE = `openid email profile ${GMAIL_SCOPE}`;
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
// v2 reads refunds and deadlines too, so history gets one fresh look. Repeats are matched
const STORAGE_KEY = 'pathfinder.gmail.v2';

/** How far back the first look goes. */
const FIRST_LOOK_DAYS = 90;
const MAX_EMAILS = 350;
const MAX_TAPS = 500;
const MAX_EMAIL_LENGTH = 2400;
const EMAIL_TOP_LENGTH = 600;
const WORDS_BEFORE_AMOUNT = 70;
const WORDS_AFTER_AMOUNT = 30;
// Gmail refuses bursts, so reads go a few at a time with a short gap between them
const PARALLEL_READS = 3;
const READ_GAP_MS = 150;
// Gmail's limit runs per minute, so the last wait has to outlast a full minute
const MAX_ATTEMPTS = 7;
const FIRST_RETRY_MS = 1000;
const RETRY_JITTER_MS = 400;

// What a purchase email tends to say, in English and French
const RECEIPT_SEARCH = [
  'receipt', '"order confirmation"', '"your order"', 'invoice', '"payment received"',
  '"transaction alert"', '"purchase alert"', '"you made a purchase"', '"e-transfer"', '"thank you for your purchase"',
  'refund', '"free trial"', '"trial ends"', '"your return"', 'reçu', '"confirmation de commande"', 'facture', 'remboursement',
].join(' OR ');

// Mail that uses those words without any money being spent. Leaving it out
// saves the limit above for real purchases, and sent mail is the user's own invoices.
const NOT_SPENDING = [
  '-in:sent', '-category:promotions', '-category:social',
  '-subject:shipped', '-subject:"out for delivery"', '-subject:delivered', '-subject:"return drop-off"',
  '-subject:"reclaim your funds"', '-subject:unsuccessful', '-subject:"been filled"', '-subject:"funds have been converted"',
  '-subject:"Pathfinder tap"',
].join(' ');

/** The subject line of the email the iPhone sends after each Apple Pay tap. */
export const TAP_SUBJECT = 'Pathfinder tap | AMOUNT | MERCHANT';

/** Looks like money: $13.10, 48.38 CAD, CA$316.40 or 13,10 $. */
const AMOUNT = /\d[.,]\d{2}(?!\d)/g;

export const GMAIL_READY = Boolean(CLIENT_ID);

export class GmailError extends Error {}

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
}

/** What Google gave back. Someone can sign in but leave the Gmail box unticked. */
export interface GoogleAccess {
  token: string;
  canReadMail: boolean;
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
            login_hint?: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string }) => void;
          }) => TokenClient;
          hasGrantedAllScopes: (response: TokenResponse, scope: string) => boolean;
        };
      };
    };
  }
}

let scriptLoading: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google) return Promise.resolve();
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      reject(new GmailError("I couldn't reach Google. Check your connection and try again."));
    };
    document.head.append(script);
  });
  return scriptLoading;
}

/**
 * Loads Google's script ahead of time. Browsers only allow a sign-in window
 * right after a click, so it has to be ready before the button is pressed.
 */
export function prepareGoogle(): void {
  if (CLIENT_ID) loadGoogleScript().catch(() => undefined);
}

const SOONER_THAN_EXPIRY_MS = 60_000;

let current: (GoogleAccess & { expires: number }) | null = null;
// Once someone leaves the Gmail box unticked, Google must be told to show it again
let askAgain = false;

function windowProblem(type?: string): string {
  if (type === 'popup_failed_to_open') return 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.';
  return 'The Google window closed before you finished. No problem, try again when you like.';
}

interface AccessOptions {
  /** Who's signed in, so Google can skip asking which account. */
  email?: string;
  /** Connecting a second inbox, such as a partner's. */
  another?: boolean;
}

/** Opens Google's own sign-in window. Pathfinder never sees the password. */
export async function requestGmailAccess({ email, another }: AccessOptions = {}): Promise<GoogleAccess> {
  if (!CLIENT_ID) throw new GmailError('Gmail needs one setup step first.');
  if (!another && current && current.canReadMail && current.expires > Date.now()) return current;
  await loadGoogleScript();
  return new Promise((resolve, reject) => {
    const oauth2 = window.google!.accounts.oauth2;
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ...(email && !another ? { login_hint: email } : {}),
      callback: (response) => {
        if (!response.access_token) {
          reject(new GmailError(response.error === 'access_denied'
            ? "Google didn't allow that account. If this app is still in testing, the account has to be on its test list."
            : "Google didn't give me access, so nothing was read."));
          return;
        }
        const access = { token: response.access_token, canReadMail: oauth2.hasGrantedAllScopes(response, GMAIL_SCOPE) };
        askAgain = !access.canReadMail;
        current = { ...access, expires: Date.now() + Number(response.expires_in ?? 3600) * 1000 - SOONER_THAN_EXPIRY_MS };
        resolve(access);
      },
      error_callback: (error) => reject(new GmailError(windowProblem(error.type))),
    });
    // Until a first look has worked, always show the screen with the Gmail box on it
    const firstTime = askAgain || connectedInboxes().length === 0;
    client.requestAccessToken({ prompt: another ? 'select_account' : firstTime ? 'consent' : '' });
  });
}

export const GMAIL_UNTICKED = "Google didn't give me access to your email. Try again, and on Google's screen tick the box about viewing your email. I only ever read, and I never send anything.";

function gmailProblem(status: number, reason = '', detail = ''): string {
  console.warn(`[Gmail] ${status} ${reason} ${detail}`);
  if (status === 401) {
    current = null;
    return 'Your Google sign-in timed out. Try again.';
  }
  if (reason === 'accessNotConfigured') return "Gmail access isn't switched on for this app's Google project yet.";
  if (reason === 'insufficientPermissions') return GMAIL_UNTICKED;
  if (status === 429 || /rate/i.test(reason)) return 'Google asked me to slow down. Try again in a minute.';
  if (status === 403) return `Google refused that request (${reason || 'no reason given'}), so nothing was read.`;
  return "I couldn't read your email just now. Try again in a moment.";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waits and tries again when Google says to slow down, so a busy moment doesn't end the scan. */
async function gmail<T>(token: string, path: string, attempt = 1): Promise<T> {
  const response = await fetch(`${API}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.ok) return response.json() as Promise<T>;

  const body = await response.json().catch(() => null) as { error?: { errors?: { reason?: string }[]; status?: string; message?: string } } | null;
  const reason = body?.error?.errors?.[0]?.reason ?? '';
  const worthRetrying = response.status === 429 || response.status >= 500 || /ratelimit/i.test(reason);
  if (worthRetrying && attempt < MAX_ATTEMPTS) {
    await wait(FIRST_RETRY_MS * 2 ** (attempt - 1) + Math.random() * RETRY_JITTER_MS);
    return gmail<T>(token, path, attempt + 1);
  }
  throw new GmailError(gmailProblem(response.status, reason, body?.error?.message));
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

interface InboxProgress {
  checked: number;
  /** Emails Google held back last time, to try again on the next look. */
  missed: string[];
}

function inboxes(): Record<string, InboxProgress> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, InboxProgress>;
  } catch {
    return {};
  }
}

/** Each inbox keeps its own place, so a family can connect more than one. */
export function connectedInboxes(): string[] {
  return Object.keys(inboxes());
}

export function inboxProgress(inbox: string): InboxProgress | null {
  return inboxes()[inbox] ?? null;
}

export function lastGmailCheck(): number | null {
  const checks = Object.values(inboxes()).map((inbox) => inbox.checked);
  return checks.length > 0 ? Math.max(...checks) : null;
}

export function rememberInbox(inbox: string, checked: number, missed: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...inboxes(), [inbox]: { checked, missed } }));
  } catch {
    // Ignore storage failures (private mode/quota)
  }
}

function searchWindow(since: number | null): string {
  return since ? `after:${Math.floor(since / 1000)}` : `newer_than:${FIRST_LOOK_DAYS}d`;
}

async function searchEmails(token: string, search: string, limit: number): Promise<string[]> {
  const query = encodeURIComponent(search);
  const ids: string[] = [];
  let pageToken = '';

  while (ids.length < limit) {
    const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(
      token,
      `messages?q=${query}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`,
    );
    ids.push(...(page.messages ?? []).map((message) => message.id));
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  return ids.slice(0, limit);
}

/** Finds emails that look like purchases, skipping promotions. */
export function findReceiptEmails(token: string, since: number | null): Promise<string[]> {
  return searchEmails(token, `(${RECEIPT_SEARCH}) ${searchWindow(since)} ${NOT_SPENDING}`, MAX_EMAILS);
}

/** Turns "Pathfinder tap | CA$12.50 | Tim Hortons" into a purchase. */
export function parseWalletTap(subject: string, date: string): StatementRow | null {
  const match = subject.match(/^(?:\w+:\s*)*Pathfinder tap\s*\|\s*([^|]*?)\s*\|\s*(.+)$/i);
  if (!match) return null;
  // French iPhones write 12,50 $
  const amount = Number(match[1].replace(/,(\d{2})(?!\d)/, '.$1').replace(/[^\d.]/g, ''));
  const description = match[2].trim().slice(0, 120);
  return amount > 0 && description ? { date, description, amount, tapped: true } : null;
}

/** Apple Pay taps arrive as emails from the user's own iPhone. No AI is needed to read them. */
export async function readWalletTaps(token: string, since: number | null): Promise<StatementRow[]> {
  const ids = await searchEmails(token, `subject:"Pathfinder tap" ${searchWindow(since)}`, MAX_TAPS);
  const taps: StatementRow[] = [];
  for (let start = 0; start < ids.length; start += PARALLEL_READS) {
    const batch = ids.slice(start, start + PARALLEL_READS);
    const messages = await Promise.all(batch.map((id) => gmail<EmailMessage>(token, `messages/${id}?format=metadata&metadataHeaders=Subject`)));
    for (const message of messages) {
      const subject = message.payload?.headers?.find((item) => item.name.toLowerCase() === 'subject')?.value ?? '';
      const tap = parseWalletTap(subject, new Date(Number(message.internalDate)).toLocaleDateString('en-CA'));
      if (tap) taps.push(tap);
    }
    await wait(READ_GAP_MS);
  }
  return taps;
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

/** Leaves only what a person would read: no markup, links or invisible padding. */
function readableText(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[\u00ad\u034f\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[\s|]+/g, ' ')
    .trim();
}

/** Totals often sit far down a long email, so keep the top and the words around each amount. */
function keepAmounts(text: string): string {
  if (text.length <= MAX_EMAIL_LENGTH) return text;
  const kept: [number, number][] = [];
  let room = MAX_EMAIL_LENGTH - EMAIL_TOP_LENGTH;

  // Last amounts first, because that's where the total usually is
  for (const { index } of [...text.matchAll(AMOUNT)].reverse()) {
    const start = Math.max(index - WORDS_BEFORE_AMOUNT, EMAIL_TOP_LENGTH);
    const end = index + WORDS_AFTER_AMOUNT;
    if (end <= EMAIL_TOP_LENGTH || kept.some(([from, to]) => index >= from && index < to)) continue;
    if (room < end - start) break;
    kept.push([start, end]);
    room -= end - start;
  }

  const pieces = kept.reverse().map(([from, to]) => text.slice(from, to));
  return [text.slice(0, EMAIL_TOP_LENGTH), ...pieces].join(' … ');
}

/** Keeps only the words, so each email costs little to read. */
export function emailToText(message: EmailMessage): string {
  const headers = message.payload?.headers ?? [];
  const header = (name: string) => headers.find((item) => item.name.toLowerCase() === name)?.value ?? '';
  const plain = readableText(findPart(message.payload, 'text/plain') ?? '');
  const html = readableText(findPart(message.payload, 'text/html') ?? '');
  // Some senders leave the amount out of the plain version, so use whichever has it
  const hasAmount = (text: string) => text.search(AMOUNT) >= 0;
  const body = (hasAmount(plain) ? plain : hasAmount(html) ? html : plain || html) || (message.snippet ?? '');
  const date = message.internalDate ? new Date(Number(message.internalDate)).toLocaleDateString('en-CA') : '';
  return `From: ${header('from')}\nDate: ${date}\nSubject: ${header('subject')}\n${keepAmounts(body)}`;
}

// Trying again carries on from where it stopped instead of reading everything twice
const alreadyRead = new Map<string, string>();

export interface EmailsRead {
  texts: string[];
  /** Emails Google wouldn't hand over, even after waiting. */
  missed: string[];
}

/**
 * Reads a few at a time, reporting progress so the agent can show its work.
 * One stubborn email is skipped rather than losing every other one.
 */
export async function readEmails(token: string, ids: string[], onProgress: (done: number) => void): Promise<EmailsRead> {
  const texts: string[] = [];
  const missed: string[] = [];
  let lastProblem: unknown = null;

  for (let start = 0; start < ids.length; start += PARALLEL_READS) {
    const batch = ids.slice(start, start + PARALLEL_READS);
    const cached = batch.every((id) => alreadyRead.has(id));
    const results = await Promise.allSettled(batch.map(async (id) => {
      const known = alreadyRead.get(id);
      if (known) return known;
      const text = emailToText(await gmail<EmailMessage>(token, `messages/${id}?format=full`));
      alreadyRead.set(id, text);
      return text;
    }));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        texts.push(result.value);
      } else {
        missed.push(batch[index]);
        lastProblem = result.reason;
      }
    });
    onProgress(texts.length + missed.length);
    if (!cached) await wait(READ_GAP_MS);
  }

  if (texts.length === 0 && lastProblem) throw lastProblem;
  return { texts, missed };
}

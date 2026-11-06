import { categorize, categoryName, countsAsSpending, merchantKey } from './budget';
import type { Budget, Rhythm } from './budget';
import { IS_STATIC_DEMO, NO_AI_KEYS } from './claude';
import type { Deadline, StatementRow } from './statement';
import { StatementError } from './statement';

const NEEDS_AI = 'Reading email and PDFs needs AI turned on. CSV statements still work.';

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

interface AgentRead {
  transactions?: StatementRow[];
  deadlines?: Deadline[];
}

async function ask(payload: object): Promise<AgentRead> {
  if (IS_STATIC_DEMO) throw new StatementError(NEEDS_AI);

  const response = await fetch('/api/budget/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({})) as AgentRead & { error?: string; code?: string };
  if (data.code === NO_AI_KEYS) throw new StatementError(NEEDS_AI);
  if (!response.ok) throw new StatementError(data.error ?? "I couldn't read that one. Try again.");
  return data;
}

export async function readPdfWithAgent(file: File): Promise<StatementRow[]> {
  const { transactions } = await ask({ file: { mediaType: 'application/pdf', data: toBase64(await file.arrayBuffer()) } });
  return transactions ?? [];
}

/** Answers a question from the family's own purchases. */
export async function askAboutMoney(budget: Budget, question: string): Promise<string> {
  if (IS_STATIC_DEMO) return NEEDS_AI;
  const money = budget.transactions.map((item) => `${item.date}, ${item.description}, ${item.amount}, ${item.categoryId}`).join('\n');
  try {
    const response = await fetch('/api/budget/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, money }),
    });
    const data = await response.json() as { answer?: string; error?: string };
    return data.answer ?? data.error ?? "I couldn't answer that.";
  } catch {
    return "I couldn't answer that.";
  }
}

/** Splits "$58.99: that's your one Amazon order" into the number and the sentence around it. */
export function readAnswer(answer: string): { figure: string | null; words: string } {
  const plain = answer.replace(/\*\*/g, '').trim();
  const match = plain.match(/^(-?\$[\d,]+(?:\.\d{2})?)(?:\s*[:,.\u2014-]\s*|\s+)([\s\S]*)$/);
  if (!match) return { figure: null, words: plain };
  return { figure: match[1], words: match[2].charAt(0).toUpperCase() + match[2].slice(1) };
}

const LONGEST_IMAGE_SIDE = 2200;
const IMAGE_QUALITY = 0.9;

/** Shrinks a picture so it uploads fast and stays sharp enough to read. */
async function imageData(file: File): Promise<string> {
  let picture: ImageBitmap;
  try {
    picture = await createImageBitmap(file);
  } catch {
    throw new StatementError("I can't open that picture. Try a PNG or JPG.");
  }
  const scale = Math.min(1, LONGEST_IMAGE_SIDE / Math.max(picture.width, picture.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(picture.width * scale);
  canvas.height = Math.round(picture.height * scale);
  canvas.getContext('2d')?.drawImage(picture, 0, 0, canvas.width, canvas.height);
  picture.close();
  return canvas.toDataURL('image/jpeg', IMAGE_QUALITY).split(',')[1];
}

/** Screenshots overlap, so a purchase on two screens counts once. Two on one screen stay two. */
export function combineScreens(screens: StatementRow[][]): StatementRow[] {
  const most = new Map<string, StatementRow[]>();
  for (const rows of screens) {
    const seen = new Map<string, StatementRow[]>();
    for (const row of rows) {
      const key = `${row.date}|${merchantKey(row.description)}|${row.amount}`;
      seen.set(key, [...(seen.get(key) ?? []), row]);
    }
    for (const [key, same] of seen) {
      if (same.length > (most.get(key)?.length ?? 0)) most.set(key, same);
    }
  }
  return [...most.values()].flat();
}

/** Reads Wallet screenshots, bank-app screens and photos of paper receipts. */
export async function readImagesWithAgent(files: File[]): Promise<StatementRow[]> {
  const screens = await Promise.all(files.map(async (file) => {
    const { transactions } = await ask({ file: { mediaType: 'image/jpeg', data: await imageData(file) } });
    return transactions ?? [];
  }));
  return combineScreens(screens);
}

const MAX_MERCHANTS = 150;

interface SortedMerchant {
  name: string;
  category: string;
  repeats?: StatementRow['repeats'];
}

/**
 * Statement lines and Apple Pay taps are only a name and an amount. The rules
 * know the common stores, and the agent places the rest. If it can't be reached
 * the rows simply stay unsorted, and the user gets asked instead.
 */
export async function sortRowsWithAgent(rows: StatementRow[], merchantRules: Record<string, string> = {}): Promise<StatementRow[]> {
  if (IS_STATIC_DEMO) return rows;
  const unknown = new Map<string, string>();
  for (const row of rows) {
    if (row.amount > 0 && !row.category && !categorize(row.description, merchantRules).sure) unknown.set(merchantKey(row.description), row.description);
  }
  if (unknown.size === 0) return rows;

  try {
    const response = await fetch('/api/budget/sort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchants: [...unknown.values()].slice(0, MAX_MERCHANTS) }),
    });
    if (!response.ok) return rows;
    const { sorted } = await response.json() as { sorted?: SortedMerchant[] };
    const byMerchant = new Map((sorted ?? []).map((item) => [merchantKey(item.name), item]));
    return rows.map((row) => {
      const match = byMerchant.get(merchantKey(row.description));
      return match && row.amount > 0 && !row.category ? { ...row, category: match.category, ...(match.repeats ? { repeats: match.repeats } : {}) } : row;
    });
  } catch {
    return rows;
  }
}

// A hosted request only lives about 30 seconds, and writing out each purchase takes the agent
// real time, so batches are small enough to finish well inside that
const EMAIL_BATCH_LENGTH = 20_000;
const EMAILS_PER_BATCH = 20;
const BATCHES_AT_ONCE = 4;

export function emailBatches(emails: string[]): string[] {
  const batches: string[] = [];
  let current = '';
  let count = 0;
  for (const email of emails) {
    if (count > 0 && (current.length + email.length > EMAIL_BATCH_LENGTH || count >= EMAILS_PER_BATCH)) {
      batches.push(current);
      current = '';
      count = 0;
    }
    current += `${email}\n\n---\n\n`;
    count += 1;
  }
  if (current) batches.push(current);
  return batches;
}

/** Runs the work a few at a time, keeping every result in order. */
async function inTurns<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]).then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason: unknown) => ({ status: 'rejected' as const, reason }),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Sends emails to the agent in manageable batches and combines what it finds. */
export async function readEmailsWithAgent(emails: string[]): Promise<{ rows: StatementRow[]; deadlines: Deadline[] }> {
  // One batch failing shouldn't lose everything the others found
  const results = await inTurns(emailBatches(emails), BATCHES_AT_ONCE, (batch) => ask({ emails: batch }).catch(() => ask({ emails: batch })));
  const reads = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  const found = reads.flatMap((read) => read.transactions ?? []);
  const failed = results.find((result) => result.status === 'rejected');
  if (found.length === 0 && failed?.status === 'rejected') throw failed.reason;
  return { rows: found.map((row) => ({ ...row, emailed: true })), deadlines: reads.flatMap((read) => read.deadlines ?? []) };
}

const PAYEES_A_BATCH = 60;
const PAYMENTS_SHOWN = 6;
// Nobody needs the agent to say a grocery store is everyday, unless the amount is strange
const PLAIN_CATEGORIES = new Set(['groceries', 'eating', 'transport']);
const STRANGE_AMOUNT = 150;

/** One line per payee, showing the pattern of dates and amounts that says what it is. */
export function rhythmLines(budget: Pick<Budget, 'transactions'>, only?: Set<string>): string[] {
  const payees = new Map<string, Budget['transactions']>();
  for (const transaction of budget.transactions) {
    if (!countsAsSpending(transaction) || transaction.amount <= 0) continue;
    const key = merchantKey(transaction.description);
    if (!only || only.has(key)) payees.set(key, [...(payees.get(key) ?? []), transaction]);
  }
  return [...payees.values()]
    .filter((payments) => !PLAIN_CATEGORIES.has(payments[0].categoryId) || payments.some((payment) => payment.amount >= STRANGE_AMOUNT))
    .map((payments) => {
      const shown = payments.slice(-PAYMENTS_SHOWN).map((payment) => `${payment.date} ${payment.amount.toFixed(2)}`).join(', ');
      return `${payments[0].description} | ${categoryName(payments[0].categoryId)} | ${shown}`;
    });
}

async function judgeBatch(lines: string[]): Promise<Record<string, Rhythm>> {
  const response = await fetch('/api/budget/rhythm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines }),
  });
  if (!response.ok) throw new Error('No verdict');
  const { judged } = await response.json() as { judged?: { name: string; rhythm: Rhythm }[] };
  return Object.fromEntries((judged ?? []).map((item) => [merchantKey(item.name), item.rhythm]));
}

/**
 * Reads each payee's history to tell bills, everyday spending and one-offs apart, so an old
 * one-off can't inflate a budget. Null if the agent can't be reached: the built-in rules decide.
 */
export async function judgeRhythms(budget: Pick<Budget, 'transactions'>, only?: Set<string>): Promise<Record<string, Rhythm> | null> {
  if (IS_STATIC_DEMO) return null;
  const lines = rhythmLines(budget, only);
  if (lines.length === 0) return {};
  const batches = Array.from({ length: Math.ceil(lines.length / PAYEES_A_BATCH) }, (_, index) => lines.slice(index * PAYEES_A_BATCH, (index + 1) * PAYEES_A_BATCH));
  const results = await inTurns(batches, BATCHES_AT_ONCE, judgeBatch);
  const verdicts = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  return verdicts.length > 0 ? Object.assign({}, ...verdicts) as Record<string, Rhythm> : null;
}

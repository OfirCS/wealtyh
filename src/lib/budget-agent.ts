import { IS_STATIC_DEMO, NO_AI_KEYS } from './claude';
import type { StatementRow } from './statement';
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

async function ask(payload: object): Promise<StatementRow[]> {
  if (IS_STATIC_DEMO) throw new StatementError(NEEDS_AI);

  const response = await fetch('/api/budget/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({})) as { transactions?: StatementRow[]; error?: string; code?: string };
  if (data.code === NO_AI_KEYS) throw new StatementError(NEEDS_AI);
  if (!response.ok) throw new StatementError(data.error ?? "I couldn't read that one. Try again.");
  return data.transactions ?? [];
}

export async function readPdfWithAgent(file: File): Promise<StatementRow[]> {
  return ask({ file: { mediaType: 'application/pdf', data: toBase64(await file.arrayBuffer()) } });
}

const EMAIL_BATCH_LENGTH = 100_000;

/** Sends emails to the agent in manageable batches and combines what it finds. */
export async function readEmailsWithAgent(emails: string[]): Promise<StatementRow[]> {
  const batches: string[] = [];
  let current = '';
  for (const email of emails) {
    if (current.length + email.length > EMAIL_BATCH_LENGTH) {
      batches.push(current);
      current = '';
    }
    current += `${email}\n\n---\n\n`;
  }
  if (current) batches.push(current);

  const results = await Promise.all(batches.map((batch) => ask({ emails: batch })));
  return results.flat();
}

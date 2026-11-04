import { IS_STATIC_DEMO, NO_AI_KEYS } from './claude';
import type { StatementRow } from './statement';
import { StatementError } from './statement';

const MAX_IMAGE_SIDE = 2000;
const NEEDS_AI = 'Reading pictures and PDFs needs AI turned on. CSV statements still work.';

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Phone screenshots and photos are huge. This keeps them readable but quick to send. */
async function shrinkImage(file: File): Promise<{ mediaType: string; data: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    return { mediaType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
  } catch {
    throw new StatementError("I can't open that picture. Try a PNG or JPG.");
  }
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

export async function readFileWithAgent(file: File): Promise<StatementRow[]> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    return ask({ file: { mediaType: 'application/pdf', data: toBase64(await file.arrayBuffer()) } });
  }
  return ask({ file: await shrinkImage(file) });
}

export function readTextWithAgent(text: string): Promise<StatementRow[]> {
  return ask({ text });
}

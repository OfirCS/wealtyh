import { describe, expect, it } from 'vitest';
import { emailBatches } from '@/lib/budget-agent';

const SEPARATOR = '\n\n---\n\n';

function emailsIn(batch: string): string[] {
  return batch.split(SEPARATOR).filter(Boolean);
}

describe('splitting emails for the agent', () => {
  it('keeps every email, in order', () => {
    const emails = Array.from({ length: 53 }, (_, index) => `email ${index}`);
    expect(emailBatches(emails).flatMap(emailsIn)).toEqual(emails);
  });

  it('never sends more than a hosted request can finish', () => {
    const emails = Array.from({ length: 53 }, (_, index) => `email ${index}`);
    expect(Math.max(...emailBatches(emails).map((batch) => emailsIn(batch).length))).toBeLessThanOrEqual(20);
  });

  it('stays under the size limit with long emails', () => {
    const batches = emailBatches(Array.from({ length: 30 }, () => 'x'.repeat(2400)));
    expect(Math.max(...batches.map((batch) => batch.length))).toBeLessThanOrEqual(20_100);
  });

  it('sends one huge email by itself rather than losing it', () => {
    const batches = emailBatches(['short', 'x'.repeat(50_000), 'short again']);
    expect(batches.flatMap(emailsIn)).toHaveLength(3);
    expect(batches).toHaveLength(3);
  });

  it('sends nothing for nothing', () => {
    expect(emailBatches([])).toEqual([]);
  });
});

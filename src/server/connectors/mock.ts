import type { Sighting } from '@/core/ledger/types';
import type { BankConnector } from './types';

const PROVIDER = 'mock';
const ACCOUNTS = [
  { id: 'mock-card', name: 'Test Visa', mask: '4242', type: 'credit card' },
  { id: 'mock-chequing', name: 'Test Chequing', mask: '1234', type: 'checking' },
];

const MONTHLY: [number, string, number, string, Sighting['kind'], string?][] = [
  [1, 'LANDLORD RENT', 210000, 'mock-chequing', 'spending', 'housing'],
  [2, 'NETFLIX.COM', 2099, 'mock-card', 'spending', 'fun'],
  [3, 'ROGERS WIRELESS', 8500, 'mock-card', 'spending', 'bills'],
  [4, 'LOBLAWS 1234 TORONTO ON', 18432, 'mock-card', 'spending', 'groceries'],
  [8, 'SHELL C03214', 7120, 'mock-card', 'spending', 'transport'],
  [11, 'TIM HORTONS #4410', 984, 'mock-card', 'spending', 'eating'],
  [14, 'PAYROLL DEPOSIT', -420000, 'mock-chequing', 'income'],
  [15, 'COSTCO WHOLESALE W1234', 26310, 'mock-card', 'spending', 'groceries'],
  [20, 'AMZN MKTP CA*ZX12A', 4599, 'mock-card', 'spending', 'shopping'],
  [24, 'PAYMENT THANK YOU', -60000, 'mock-card', 'transfer'],
  [24, 'VISA PAYMENT', 60000, 'mock-chequing', 'transfer'],
  [27, 'LCBO/RAO #0217', 3845, 'mock-card', 'spending', 'fun'],
];

function sighting(id: string, date: string, merchant: string, amountCents: number, accountId: string, kind: Sighting['kind'], categoryId?: string, pending = false): Sighting {
  return { id: `${PROVIDER}:${id}`, source: 'bank', provider: PROVIDER, accountId, date, amountCents, currency: 'CAD', merchant, pending, kind, ...(categoryId ? { categoryId } : {}) };
}

function history(today: Date): Sighting[] {
  const rows: Sighting[] = [];
  for (let back = 2; back >= 0; back--) {
    const month = new Date(today.getFullYear(), today.getMonth() - back, 1);
    for (const [day, merchant, amount, account, kind, category] of MONTHLY) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      if (date > today) continue;
      const iso = date.toLocaleDateString('en-CA');
      rows.push(sighting(`${iso}-${merchant.slice(0, 8)}-${account}`, iso, merchant, amount, account, kind, category));
    }
  }
  return rows;
}

/**
 * A pretend bank for building without Plaid keys. The second sync posts a pending charge with a
 * tip, the way a real one arrives. Never reachable in production: see connectors/index.ts.
 */
export const mock: BankConnector = {
  name: PROVIDER,

  async createLink() {
    return { linkToken: 'mock-link', mode: 'mock' };
  },

  async exchange() {
    return { accessToken: 'mock-access', itemId: `mock-${crypto.randomUUID()}`, institution: 'Test Bank', accounts: ACCOUNTS };
  },

  async sync(_accessToken, cursor) {
    const today = new Date();
    const iso = today.toLocaleDateString('en-CA');
    const pendingId = `${iso}-pending`;
    if (!cursor) {
      const pending = sighting(pendingId, iso, 'PAI NORTHERN THAI', 4000, 'mock-card', 'spending', 'eating', true);
      return { added: [...history(today), pending], modified: [], removed: [], cursor: 'first', needsLogin: false, notReady: false };
    }
    if (cursor === 'first') {
      const posted = { ...sighting(`${iso}-posted`, iso, 'PAI NORTHERN THAI', 4800, 'mock-card', 'spending', 'eating'), replacesId: `${PROVIDER}:${pendingId}` };
      return { added: [posted], modified: [], removed: [`${PROVIDER}:${pendingId}`], cursor: 'second', needsLogin: false, notReady: false };
    }
    return { added: [], modified: [], removed: [], cursor, needsLogin: false, notReady: false };
  },

  async disconnect() {},
};

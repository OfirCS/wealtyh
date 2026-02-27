import type { FinancialProfile, QuickAction, CustomFund } from './types';

const ACCOUNT_KEY_MAP: Record<string, keyof FinancialProfile> = {
  'chequing': 'chequingBalance',
  'savings': 'savingsBalance',
  'tfsa': 'tfsaBalance',
  'rrsp': 'rrspBalance',
  'fhsa': 'fhsaBalance',
  'non-registered': 'nonRegBalance',
  'non-reg': 'nonRegBalance',
  'nonreg': 'nonRegBalance',
};

function resolveAccountKey(name: string): keyof FinancialProfile | null {
  const normalized = name.toLowerCase().trim();
  for (const [key, field] of Object.entries(ACCOUNT_KEY_MAP)) {
    if (normalized.includes(key)) return field;
  }
  return null;
}

function guessEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('emergency') || lower.includes('rainy')) return '\u{1F6E1}\uFE0F';
  if (lower.includes('vacation') || lower.includes('travel') || lower.includes('trip')) return '\u2708\uFE0F';
  if (lower.includes('car') || lower.includes('vehicle')) return '\u{1F697}';
  if (lower.includes('house') || lower.includes('home') || lower.includes('down payment')) return '\u{1F3E0}';
  if (lower.includes('education') || lower.includes('school') || lower.includes('course')) return '\u{1F393}';
  if (lower.includes('wedding')) return '\u{1F48D}';
  if (lower.includes('baby') || lower.includes('child') || lower.includes('kid')) return '\u{1F476}';
  if (lower.includes('business') || lower.includes('startup')) return '\u{1F4BC}';
  if (lower.includes('tech') || lower.includes('computer') || lower.includes('gadget')) return '\u{1F4BB}';
  if (lower.includes('gift')) return '\u{1F381}';
  return '\u{1F4B0}';
}

export interface ApplyResult {
  profile: FinancialProfile;
  customFunds: CustomFund[];
}

export function applyConfirmedActions(
  profile: FinancialProfile,
  existingFunds: CustomFund[],
  confirmedIndices: number[],
  actions: QuickAction[],
): ApplyResult {
  const p = { ...profile };
  const funds = existingFunds.map((f) => ({ ...f }));

  function deduct(key: keyof FinancialProfile, amount: number) {
    (p as unknown as Record<string, number>)[key] = Math.max(0, (p[key] as number) - amount);
  }

  function credit(key: keyof FinancialProfile, amount: number) {
    (p as unknown as Record<string, number>)[key] = (p[key] as number) + amount;
  }

  function creditOrCreateFund(name: string, amount: number) {
    const key = resolveAccountKey(name);
    if (key) {
      credit(key, amount);
      if (key === 'tfsaBalance') p.tfsaRoom = Math.max(0, p.tfsaRoom - amount);
      if (key === 'rrspBalance') p.rrspRoom = Math.max(0, p.rrspRoom - amount);
    } else {
      const existing = funds.find((f) => f.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        existing.balance += amount;
      } else {
        funds.push({ name, balance: amount, emoji: guessEmoji(name) });
      }
    }
  }

  for (const idx of confirmedIndices) {
    const action = actions[idx];
    if (!action) continue;
    const amount = action.amount ?? 0;

    switch (action.type) {
      case 'move': {
        const fromKey = action.from_account ? resolveAccountKey(action.from_account) : 'chequingBalance';
        if (fromKey) deduct(fromKey, amount);
        if (action.to_account) creditOrCreateFund(action.to_account, amount);
        break;
      }
      case 'create_fund': {
        const fromKey = action.from_account ? resolveAccountKey(action.from_account) : 'chequingBalance';
        if (fromKey) deduct(fromKey, amount);
        const fundName = action.to_account || action.title;
        creditOrCreateFund(fundName, amount);
        break;
      }
      case 'open_account': {
        if (amount > 0) {
          const fromKey = action.from_account ? resolveAccountKey(action.from_account) : 'chequingBalance';
          if (fromKey) deduct(fromKey, amount);
          if (action.to_account) creditOrCreateFund(action.to_account, amount);
        }
        break;
      }
      case 'automate': {
        if (action.automation && action.automation.amount > 0) {
          const depositAmount = action.automation.amount;
          const fromKey = action.from_account ? resolveAccountKey(action.from_account) : 'chequingBalance';
          if (fromKey) deduct(fromKey, depositAmount);
          if (action.to_account) creditOrCreateFund(action.to_account, depositAmount);
        }
        break;
      }
      case 'pay_off': {
        const fromKey = action.from_account ? resolveAccountKey(action.from_account) : 'chequingBalance';
        if (fromKey) deduct(fromKey, amount);
        break;
      }
      case 'pause':
      case 'adjust':
        break;
    }
  }

  return { profile: p, customFunds: funds };
}

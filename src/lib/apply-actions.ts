import type { FinancialProfile, QuickAction, CustomFund } from './types';
import { getCanadianRuleSet } from './prompts';

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function normalizeFundKey(name: string): string {
  return normalizeName(name).replace(/[^a-z0-9]/g, '');
}

function tokenizeName(name: string): string[] {
  return normalizeName(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function resolveAccountKey(name: string): keyof FinancialProfile | null {
  const normalized = normalizeName(name)
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Treat chequing/savings as built-in accounts only for generic account phrases.
  // This prevents custom funds like "Thailand Savings Fund" from being misclassified.
  if (/^(my\s+)?(chequing|checking)(\s+account)?$/.test(normalized)) return 'chequingBalance';
  if (/^(my\s+)?(savings?|saving)(\s+account)?$/.test(normalized)) return 'savingsBalance';

  if (/\btfsa\b/.test(normalized)) return 'tfsaBalance';
  if (/\brrsp\b/.test(normalized)) return 'rrspBalance';
  if (/\bfhsa\b/.test(normalized)) return 'fhsaBalance';
  if (/\bnon[\s-]?registered\b/.test(normalized) || /\bnon[\s-]?reg\b/.test(normalized) || /\bnonreg\b/.test(normalized)) {
    return 'nonRegBalance';
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
  const rules = getCanadianRuleSet();
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
      // Cap deposits to registered account room
      let cappedAmount = amount;
      if (key === 'tfsaBalance') {
        cappedAmount = Math.min(amount, p.tfsaRoom);
        p.tfsaRoom = Math.max(0, p.tfsaRoom - cappedAmount);
      } else if (key === 'rrspBalance') {
        cappedAmount = Math.min(amount, p.rrspRoom);
        p.rrspRoom = Math.max(0, p.rrspRoom - cappedAmount);
      } else if (key === 'fhsaBalance') {
        const fhsaRoom = Math.max(0, rules.fhsaAnnualRoom - (p.fhsaBalance as number));
        cappedAmount = Math.min(amount, fhsaRoom);
      }
      credit(key, cappedAmount);
    } else {
      const existing = funds.find((f) => normalizeName(f.name) === normalizeName(name));
      if (existing) {
        existing.balance += amount;
      } else {
        funds.push({ name, balance: amount, emoji: guessEmoji(name) });
      }
    }
  }

  function findCustomFund(name: string): CustomFund | undefined {
    const requested = normalizeFundKey(name);
    if (!requested) return undefined;

    const exact = funds.find((f) => normalizeFundKey(f.name) === requested);
    if (exact) return exact;

    const partialMatches = funds.filter((f) => {
      const key = normalizeFundKey(f.name);
      return key.includes(requested) || requested.includes(key);
    });

    if (partialMatches.length === 1) return partialMatches[0];

    // If multiple partial matches exist, prefer the closest length match.
    if (partialMatches.length > 1) {
      return partialMatches.sort((a, b) => {
        const aDelta = Math.abs(normalizeFundKey(a.name).length - requested.length);
        const bDelta = Math.abs(normalizeFundKey(b.name).length - requested.length);
        return aDelta - bDelta;
      })[0];
    }

    const requestedTokens = new Set(tokenizeName(name));
    if (requestedTokens.size > 0) {
      const tokenMatches = funds
        .map((fund) => {
          const fundTokens = tokenizeName(fund.name);
          const overlap = fundTokens.filter((token) => requestedTokens.has(token)).length;
          return { fund, overlap, lengthDelta: Math.abs(normalizeFundKey(fund.name).length - requested.length) };
        })
        .filter((candidate) => candidate.overlap > 0)
        .sort((a, b) => {
          if (b.overlap !== a.overlap) return b.overlap - a.overlap;
          return a.lengthDelta - b.lengthDelta;
        });

      if (tokenMatches.length === 1) return tokenMatches[0].fund;
      if (tokenMatches.length > 1 && tokenMatches[0].overlap > tokenMatches[1].overlap) {
        return tokenMatches[0].fund;
      }
    }

    return undefined;
  }

  /**
   * Withdraws from a source account or custom fund and returns the actual moved amount.
   * If source is omitted, defaults to chequing.
   * If source is provided but unknown, returns 0 (do not create money).
   */
  function withdrawFromSource(sourceName: string | undefined, requestedAmount: number): number {
    if (requestedAmount <= 0) return 0;

    if (!sourceName || sourceName.trim().length === 0) {
      const available = p.chequingBalance;
      const actual = Math.min(requestedAmount, available);
      deduct('chequingBalance', actual);
      return actual;
    }

    const accountKey = resolveAccountKey(sourceName);
    if (accountKey) {
      const available = p[accountKey] as number;
      const actual = Math.min(requestedAmount, available);
      deduct(accountKey, actual);
      return actual;
    }

    const fund = findCustomFund(sourceName);
    if (fund) {
      const actual = Math.min(requestedAmount, fund.balance);
      fund.balance = Math.max(0, fund.balance - actual);
      return actual;
    }

    return 0;
  }

  for (const idx of confirmedIndices) {
    const action = actions[idx];
    if (!action) continue;
    const amount = action.amount ?? 0;

    switch (action.type) {
      case 'move': {
        const movedAmount = withdrawFromSource(action.from_account, amount);
        if (action.to_account && movedAmount > 0) creditOrCreateFund(action.to_account, movedAmount);
        break;
      }
      case 'create_fund': {
        const movedAmount = withdrawFromSource(action.from_account, amount);
        const fundName = action.to_account || action.title;
        if (movedAmount > 0) creditOrCreateFund(fundName, movedAmount);
        break;
      }
      case 'open_account': {
        if (amount > 0) {
          const movedAmount = withdrawFromSource(action.from_account, amount);
          if (action.to_account && movedAmount > 0) creditOrCreateFund(action.to_account, movedAmount);
        }
        break;
      }
      case 'automate': {
        if (action.automation && action.automation.amount > 0) {
          const depositAmount = action.automation.amount;
          const movedAmount = withdrawFromSource(action.from_account, depositAmount);
          if (action.to_account && movedAmount > 0) creditOrCreateFund(action.to_account, movedAmount);
        }
        break;
      }
      case 'pay_off': {
        const hint = `${action.to_account ?? ''} ${action.title ?? ''}`.toLowerCase();
        const target = hint.includes('mortgage')
          ? 'mortgage'
          : hint.includes('credit') || hint.includes('card')
            ? 'credit'
            : p.creditCardBalance > 0
              ? 'credit'
              : 'mortgage';

        const outstanding = target === 'credit' ? p.creditCardBalance : p.mortgageBalance;
        if (outstanding <= 0) break;

        const requestedPayoff = Math.min(amount, outstanding);
        const paidAmount = withdrawFromSource(action.from_account, requestedPayoff);
        if (target === 'credit') {
          p.creditCardBalance = Math.max(0, p.creditCardBalance - paidAmount);
        } else {
          p.mortgageBalance = Math.max(0, p.mortgageBalance - paidAmount);
        }
        break;
      }
      case 'pause':
      case 'adjust':
        break;
    }
  }

  return { profile: p, customFunds: funds };
}

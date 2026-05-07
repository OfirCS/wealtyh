import type { FinancialProfile, CustomFund } from './types';

const MAX_EVENT_LENGTH = 280;
const MAX_FUND_NAME = 64;
const MAX_FUNDS = 12;

const REQUIRED_NUMERIC_FIELDS: Array<keyof FinancialProfile> = [
  'annualIncome',
  'partnerIncome',
  'chequingBalance',
  'savingsBalance',
  'tfsaBalance',
  'tfsaRoom',
  'rrspBalance',
  'rrspRoom',
  'fhsaBalance',
  'nonRegBalance',
  'housingExpense',
  'mortgageBalance',
  'essentialExpenses',
  'discretionarySpending',
  'debtPayments',
  'creditCardBalance',
];

export interface ValidationError {
  ok: false;
  status: number;
  message: string;
}

export interface ValidationOk {
  ok: true;
  profile: FinancialProfile;
  customFunds: CustomFund[];
  lifeEvent: string;
}

export function validatePathfinderInput(body: unknown): ValidationOk | ValidationError {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, message: 'Invalid request body' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.lifeEvent !== 'string' || b.lifeEvent.trim().length === 0) {
    return { ok: false, status: 400, message: 'lifeEvent is required' };
  }
  if (b.lifeEvent.length > MAX_EVENT_LENGTH) {
    return { ok: false, status: 400, message: `lifeEvent exceeds ${MAX_EVENT_LENGTH} chars` };
  }

  if (!b.profile || typeof b.profile !== 'object') {
    return { ok: false, status: 400, message: 'profile is required' };
  }
  const profile = b.profile as Record<string, unknown>;
  for (const field of REQUIRED_NUMERIC_FIELDS) {
    const v = profile[field as string];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < -1e9 || v > 1e9) {
      return { ok: false, status: 400, message: `Invalid value for ${String(field)}` };
    }
  }

  let customFunds: CustomFund[] = [];
  if (Array.isArray(b.customFunds)) {
    if (b.customFunds.length > MAX_FUNDS) {
      return { ok: false, status: 400, message: `Too many custom funds (max ${MAX_FUNDS})` };
    }
    customFunds = b.customFunds
      .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
      .map((f) => ({
        name: typeof f.name === 'string' ? f.name.slice(0, MAX_FUND_NAME) : '',
        balance: typeof f.balance === 'number' && Number.isFinite(f.balance) ? f.balance : 0,
        emoji: typeof f.emoji === 'string' ? f.emoji.slice(0, 8) : undefined,
      }))
      .filter((f) => f.name.length > 0);
  }

  return {
    ok: true,
    profile: profile as unknown as FinancialProfile,
    customFunds,
    lifeEvent: b.lifeEvent.trim(),
  };
}

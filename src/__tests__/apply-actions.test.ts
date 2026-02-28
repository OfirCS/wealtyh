import { describe, it, expect } from 'vitest';
import { applyConfirmedActions } from '@/lib/apply-actions';
import type { FinancialProfile, QuickAction, CustomFund } from '@/lib/types';

// ── Base profile for tests ──────────────────────────────────────────────────

const BASE_PROFILE: FinancialProfile = {
  annualIncome: 85000,
  employmentType: 'employed',
  partnerIncome: 65000,
  province: 'ON',
  chequingBalance: 10000,
  savingsBalance: 5000,
  tfsaBalance: 20000,
  tfsaRoom: 7000,
  rrspBalance: 15000,
  rrspRoom: 10000,
  fhsaBalance: 5250,
  nonRegBalance: 3000,
  housingType: 'rent',
  housingExpense: 2200,
  mortgageBalance: 0,
  essentialExpenses: 1800,
  discretionarySpending: 800,
  debtPayments: 400,
};

function action(overrides: Partial<QuickAction> & Pick<QuickAction, 'type'>): QuickAction {
  return {
    title: 'Test action',
    why: 'Testing',
    priority: 'do_now',
    ...overrides,
  };
}

// ── move ────────────────────────────────────────────────────────────────────

describe('move action', () => {
  it('transfers from chequing to savings', () => {
    const a = action({ type: 'move', amount: 2000, from_account: 'Chequing', to_account: 'Savings' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(8000);
    expect(profile.savingsBalance).toBe(7000);
  });

  it('defaults from_account to chequing when omitted', () => {
    const a = action({ type: 'move', amount: 1000, to_account: 'Savings' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(9000);
    expect(profile.savingsBalance).toBe(6000);
  });

  it('creates a custom fund when to_account is non-standard', () => {
    const a = action({ type: 'move', amount: 500, from_account: 'Chequing', to_account: 'Emergency Fund' });
    const { profile, customFunds } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(9500);
    expect(customFunds).toHaveLength(1);
    expect(customFunds[0].name).toBe('Emergency Fund');
    expect(customFunds[0].balance).toBe(500);
  });

  it('deducts TFSA room when crediting TFSA', () => {
    const a = action({ type: 'move', amount: 3000, from_account: 'Chequing', to_account: 'TFSA' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.tfsaBalance).toBe(23000);
    expect(profile.tfsaRoom).toBe(4000);
  });

  it('deducts RRSP room when crediting RRSP', () => {
    const a = action({ type: 'move', amount: 5000, from_account: 'Chequing', to_account: 'RRSP' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.rrspBalance).toBe(20000);
    expect(profile.rrspRoom).toBe(5000);
  });

  it('clamps balance at 0 when deducting more than available', () => {
    const a = action({ type: 'move', amount: 99999, from_account: 'Chequing', to_account: 'Savings' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(0);
    expect(profile.savingsBalance).toBe(104999);
  });
});

// ── create_fund ─────────────────────────────────────────────────────────────

describe('create_fund action', () => {
  it('creates a new custom fund and deducts from source', () => {
    const a = action({ type: 'create_fund', amount: 1000, from_account: 'Chequing', to_account: 'Vacation Fund' });
    const { profile, customFunds } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(9000);
    expect(customFunds).toHaveLength(1);
    expect(customFunds[0].name).toBe('Vacation Fund');
    expect(customFunds[0].balance).toBe(1000);
    expect(customFunds[0].emoji).toBe('✈️');
  });

  it('tops up an existing custom fund', () => {
    const existing: CustomFund[] = [{ name: 'Vacation Fund', balance: 2000, emoji: '✈️' }];
    const a = action({ type: 'create_fund', amount: 500, from_account: 'Chequing', to_account: 'Vacation Fund' });
    const { customFunds } = applyConfirmedActions(BASE_PROFILE, existing, [0], [a]);
    expect(customFunds).toHaveLength(1);
    expect(customFunds[0].balance).toBe(2500);
  });

  it('falls back to action.title when to_account is missing', () => {
    const a = action({ type: 'create_fund', amount: 500, title: 'Baby Fund', from_account: 'Savings' });
    const { customFunds } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(customFunds).toHaveLength(1);
    expect(customFunds[0].name).toBe('Baby Fund');
    expect(customFunds[0].emoji).toBe('👶');
  });
});

// ── open_account ────────────────────────────────────────────────────────────

describe('open_account action', () => {
  it('deducts from source and credits destination for initial deposit', () => {
    const a = action({ type: 'open_account', amount: 1000, from_account: 'Chequing', to_account: 'FHSA' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(9000);
    expect(profile.fhsaBalance).toBe(6250);
  });

  it('does nothing when amount is 0', () => {
    const a = action({ type: 'open_account', amount: 0, to_account: 'FHSA' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(10000);
    expect(profile.fhsaBalance).toBe(5250);
  });
});

// ── automate ────────────────────────────────────────────────────────────────

describe('automate action', () => {
  it('uses automation.amount, not action.amount', () => {
    const a = action({
      type: 'automate',
      amount: 9999,
      from_account: 'Chequing',
      to_account: 'Savings',
      automation: { amount: 200, frequency: 'monthly' },
    });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(9800);
    expect(profile.savingsBalance).toBe(5200);
  });

  it('does nothing when automation is missing', () => {
    const a = action({ type: 'automate', amount: 500, from_account: 'Chequing', to_account: 'Savings' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(10000);
    expect(profile.savingsBalance).toBe(5000);
  });

  it('does nothing when automation.amount is 0', () => {
    const a = action({
      type: 'automate',
      from_account: 'Chequing',
      to_account: 'Savings',
      automation: { amount: 0, frequency: 'biweekly' },
    });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(10000);
  });
});

// ── pay_off ─────────────────────────────────────────────────────────────────

describe('pay_off action', () => {
  it('deducts from source account only', () => {
    const a = action({ type: 'pay_off', amount: 3000, from_account: 'Savings' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.savingsBalance).toBe(2000);
  });

  it('defaults to chequing when from_account is omitted', () => {
    const a = action({ type: 'pay_off', amount: 1500 });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(8500);
  });
});

// ── pause / adjust (no-ops) ─────────────────────────────────────────────────

describe('pause and adjust actions', () => {
  it('pause does not mutate profile', () => {
    const a = action({ type: 'pause', amount: 500 });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile).toEqual(BASE_PROFILE);
  });

  it('adjust does not mutate profile', () => {
    const a = action({ type: 'adjust', amount: 500 });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile).toEqual(BASE_PROFILE);
  });
});

// ── confirmedIndices filtering ──────────────────────────────────────────────

describe('confirmedIndices filtering', () => {
  it('only applies actions at confirmed indices', () => {
    const actions: QuickAction[] = [
      action({ type: 'move', amount: 1000, from_account: 'Chequing', to_account: 'Savings' }),
      action({ type: 'move', amount: 2000, from_account: 'Chequing', to_account: 'Savings' }),
      action({ type: 'move', amount: 3000, from_account: 'Chequing', to_account: 'Savings' }),
    ];
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0, 2], actions);
    // Only actions 0 ($1000) and 2 ($3000) applied = $4000 total moved
    expect(profile.chequingBalance).toBe(6000);
    expect(profile.savingsBalance).toBe(9000);
  });

  it('skips invalid indices gracefully', () => {
    const a = action({ type: 'move', amount: 500, to_account: 'Savings' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0, 5, 99], [a]);
    expect(profile.chequingBalance).toBe(9500);
    expect(profile.savingsBalance).toBe(5500);
  });

  it('returns unchanged profile when no indices confirmed', () => {
    const a = action({ type: 'move', amount: 1000, to_account: 'Savings' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [], [a]);
    expect(profile.chequingBalance).toBe(10000);
  });
});

// ── guessEmoji (tested via create_fund) ─────────────────────────────────────

describe('emoji assignment', () => {
  const cases: [string, string][] = [
    ['Emergency Fund', '🛡️'],
    ['Vacation Fund', '✈️'],
    ['Car Fund', '🚗'],
    ['Down Payment', '🏠'],
    ['Education Fund', '🎓'],
    ['Wedding Fund', '💍'],
    ['Baby Fund', '👶'],
    ['Startup Capital', '💼'],
    ['New Computer', '💻'],
    ['Gift Fund', '🎁'],
    ['Random Thing', '💰'],
  ];

  it.each(cases)('"%s" gets emoji %s', (fundName, expectedEmoji) => {
    const a = action({ type: 'create_fund', amount: 100, to_account: fundName });
    const { customFunds } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(customFunds[0].emoji).toBe(expectedEmoji);
  });
});

// ── immutability ────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('does not mutate the original profile object', () => {
    const original = { ...BASE_PROFILE };
    const a = action({ type: 'move', amount: 5000, from_account: 'Chequing', to_account: 'Savings' });
    applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(BASE_PROFILE.chequingBalance).toBe(original.chequingBalance);
    expect(BASE_PROFILE.savingsBalance).toBe(original.savingsBalance);
  });

  it('does not mutate the original custom funds array', () => {
    const funds: CustomFund[] = [{ name: 'Fund A', balance: 1000, emoji: '💰' }];
    const a = action({ type: 'create_fund', amount: 500, to_account: 'Fund A' });
    applyConfirmedActions(BASE_PROFILE, funds, [0], [a]);
    expect(funds[0].balance).toBe(1000);
  });
});

// ── multiple sequential actions ─────────────────────────────────────────────

describe('multiple sequential actions', () => {
  it('applies all confirmed actions in order', () => {
    const actions: QuickAction[] = [
      action({ type: 'move', amount: 2000, from_account: 'Chequing', to_account: 'TFSA' }),
      action({ type: 'create_fund', amount: 1000, from_account: 'Chequing', to_account: 'Emergency Fund' }),
      action({ type: 'pay_off', amount: 500, from_account: 'Chequing' }),
    ];
    const { profile, customFunds } = applyConfirmedActions(BASE_PROFILE, [], [0, 1, 2], actions);
    // Chequing: 10000 - 2000 - 1000 - 500 = 6500
    expect(profile.chequingBalance).toBe(6500);
    expect(profile.tfsaBalance).toBe(22000);
    expect(profile.tfsaRoom).toBe(5000);
    expect(customFunds).toHaveLength(1);
    expect(customFunds[0].balance).toBe(1000);
  });
});

// ── account key resolution ──────────────────────────────────────────────────

describe('account key resolution', () => {
  it('resolves non-reg variants', () => {
    const a = action({ type: 'move', amount: 500, from_account: 'Non-Registered', to_account: 'Savings' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.nonRegBalance).toBe(2500);
  });

  it('resolves case-insensitive account names', () => {
    const a = action({ type: 'move', amount: 500, from_account: 'CHEQUING', to_account: 'SAVINGS' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.chequingBalance).toBe(9500);
    expect(profile.savingsBalance).toBe(5500);
  });

  it('resolves partial matches like "my tfsa account"', () => {
    const a = action({ type: 'move', amount: 1000, from_account: 'Chequing', to_account: 'my TFSA account' });
    const { profile } = applyConfirmedActions(BASE_PROFILE, [], [0], [a]);
    expect(profile.tfsaBalance).toBe(21000);
    expect(profile.tfsaRoom).toBe(6000);
  });
});

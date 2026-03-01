import { describe, it, expect } from 'vitest';
import { applyPostParseGuardrails } from '@/lib/pathfinder-engine';
import { getCanadianRuleSet } from '@/lib/prompts';
import type { FinancialProfile, CustomFund, PathfinderResult, QuickAction } from '@/lib/types';

const BASE_PROFILE: FinancialProfile = {
  annualIncome: 85000,
  employmentType: 'employed',
  partnerIncome: 0,
  province: 'ON',
  chequingBalance: 7000,
  savingsBalance: 2000,
  tfsaBalance: 2000,
  tfsaRoom: 7000,
  rrspBalance: 0,
  rrspRoom: 10000,
  fhsaBalance: 0,
  nonRegBalance: 0,
  housingType: 'rent',
  housingExpense: 2200,
  mortgageBalance: 0,
  essentialExpenses: 1800,
  discretionarySpending: 800,
  debtPayments: 200,
  creditCardBalance: 0,
};

function makeResult(actions: QuickAction[]): PathfinderResult {
  return {
    thinking_steps: [{ title: 'Goal update', insights: [{ text: '$5,000 can be repurposed', type: 'neutral' }] }],
    impact_summary: {
      income_change: { value: '$0', label: 'No change', type: 'neutral' },
      expense_change: { value: '$0', label: 'No change', type: 'neutral' },
      net_worth_change: { value: '$0', label: 'No change', type: 'neutral' },
      timeline: { value: '1 month', label: 'Immediate', type: 'neutral' },
    },
    quick_actions: actions,
    advisor_flags: [],
    risk_warnings: [],
    account_impacts: [],
    monthly_cashflow: [{ phase: 'Current', amount: 1000 }],
  };
}

describe('applyPostParseGuardrails source matching', () => {
  it('keeps a move from custom fund when source uses partial wording', () => {
    const customFunds: CustomFund[] = [{ name: 'Thailand Savings Fund', balance: 5000, emoji: '✈️' }];
    const input = makeResult([
      {
        title: 'Move $5,000 from Thailand account → Emergency Fund',
        why: 'Switch to safer goal',
        derived_from: '$5,000 already in old goal',
        type: 'move',
        amount: 5000,
        from_account: 'Thailand account',
        to_account: 'Emergency Fund',
        priority: 'do_now',
      },
    ]);

    const removed: string[] = [];
    const guarded = applyPostParseGuardrails(
      structuredClone(input),
      BASE_PROFILE,
      customFunds,
      'Forget Thailand goal and build emergency fund',
      getCanadianRuleSet(2026),
      removed,
    );

    expect(guarded.quick_actions).toHaveLength(1);
    expect(guarded.quick_actions[0].from_account).toBe('Thailand Savings Fund');
    expect(removed).toHaveLength(0);
  });
});

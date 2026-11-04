import { describe, expect, it } from 'vitest';
import { applyConfirmedActions } from '@/lib/apply-actions';
import { DEFAULT_PROFILE } from '@/lib/defaults';
import { buildLocalPlan, detectPlanKind } from '@/lib/local-plan';
import { estimateTakeHome, getMoneyPicture } from '@/lib/money';
import type { FinancialProfile } from '@/lib/types';

const EMPTY: FinancialProfile = {
  ...DEFAULT_PROFILE,
  annualIncome: 0,
  partnerIncome: 0,
  chequingBalance: 0,
  savingsBalance: 0,
  tfsaBalance: 0,
  tfsaRoom: 0,
  rrspBalance: 0,
  rrspRoom: 0,
  fhsaBalance: 0,
  nonRegBalance: 0,
  housingExpense: 0,
  essentialExpenses: 0,
  discretionarySpending: 0,
  debtPayments: 0,
  creditCardBalance: 0,
};

const STRETCHED: FinancialProfile = {
  ...EMPTY,
  annualIncome: 42000,
  chequingBalance: 900,
  savingsBalance: 400,
  housingExpense: 1900,
  essentialExpenses: 900,
  discretionarySpending: 300,
  debtPayments: 350,
  creditCardBalance: 7200,
};

const WEALTHY: FinancialProfile = {
  ...DEFAULT_PROFILE,
  annualIncome: 240000,
  partnerIncome: 180000,
  savingsBalance: 310000,
  chequingBalance: 45000,
  housingType: 'own',
  mortgageBalance: 620000,
  housingExpense: 4800,
};

const PROFILES = { sample: DEFAULT_PROFILE, empty: EMPTY, stretched: STRETCHED, wealthy: WEALTHY };

const EVENTS = [
  'Having a baby this spring',
  'Buying my first home',
  'Taking a 9 month career break',
  'I got laid off last week',
  'I want to pay off my credit card',
  'Build an emergency fund',
  'Going back to school for $25k',
  'Starting a business, saving $3,000/mo',
  'Use my TFSA room',
];

describe('detectPlanKind', () => {
  it.each([
    ['We are expecting a baby', 'baby'],
    ['Buying a condo downtown', 'home'],
    ['I just got laid off', 'job'],
    ['Taking a sabbatical', 'break'],
    ['Pay off my debt', 'debt'],
    ['I need a safety net', 'buffer'],
    ['Planning a wedding', 'goal'],
    ['What should I do with my money?', 'general'],
  ])('%s -> %s', (event, kind) => {
    expect(detectPlanKind(event)).toBe(kind);
  });
});

describe('estimateTakeHome', () => {
  it('rises with income and never exceeds gross', () => {
    const incomes = [0, 20000, 50000, 85000, 150000, 250000, 500000, 1000000];
    const results = incomes.map(estimateTakeHome);
    results.slice(1).forEach((value, i) => expect(value).toBeGreaterThan(results[i]));
    incomes.forEach((income, i) => expect(results[i]).toBeLessThanOrEqual(income));
  });
});

describe('buildLocalPlan', () => {
  for (const [name, profile] of Object.entries(PROFILES)) {
    for (const event of EVENTS) {
      describe(`${name}: ${event}`, () => {
        const plan = buildLocalPlan(profile, [], event);

        it('is marked as a local plan and gives at least one step', () => {
          expect(plan.source).toBe('local');
          expect(plan.quick_actions.length).toBeGreaterThan(0);
        });

        it('never prints a broken number', () => {
          expect(JSON.stringify(plan)).not.toMatch(/NaN|Infinity|undefined/);
        });

        it('starts cashflow from what the user really has left', () => {
          expect(plan.monthly_cashflow[0].amount).toBe(Math.round(getMoneyPicture(profile).leftOver));
          expect(plan.monthly_cashflow.length).toBeGreaterThanOrEqual(2);
        });

        it('conserves money when every step is applied', () => {
          const indices = plan.quick_actions.map((_, i) => i);
          const applied = applyConfirmedActions(profile, [], indices, plan.quick_actions);
          const before = getMoneyPicture(profile).totalMoney;
          const after = getMoneyPicture(applied.profile, applied.customFunds).totalMoney;
          expect(after).toBeCloseTo(before, 2);
        });

        it('keeps a month of spending in cash unless the user started below that', () => {
          const indices = plan.quick_actions.map((_, i) => i).filter((i) => plan.quick_actions[i].type !== 'automate' && plan.quick_actions[i].type !== 'open_account');
          const applied = applyConfirmedActions(profile, [], indices, plan.quick_actions);
          const { cash, monthlySpend } = getMoneyPicture(profile);
          expect(getMoneyPicture(applied.profile).cash).toBeGreaterThanOrEqual(Math.min(cash, monthlySpend));
        });

        it('keeps the chequing floor', () => {
          const indices = plan.quick_actions.map((_, i) => i);
          const applied = applyConfirmedActions(profile, [], indices, plan.quick_actions);
          expect(applied.profile.chequingBalance).toBeGreaterThanOrEqual(0);
        });
      });
    }
  }

  it('only commits money that is actually left over', () => {
    const plan = buildLocalPlan(STRETCHED, [], 'Build an emergency fund');
    expect(plan.quick_actions.filter((action) => action.automation)).toHaveLength(0);
    expect(plan.risk_warnings.some((risk) => risk.severity === 'high')).toBe(true);
  });

  it('uses the length the user asked for', () => {
    expect(buildLocalPlan(DEFAULT_PROFILE, [], 'Career break for 9 months').thinking_steps[1].title).toContain('9 months');
    expect(buildLocalPlan(DEFAULT_PROFILE, [], 'Career break for 1 month').thinking_steps[1].title).toContain('1 month off');
  });

  it('reads a stated goal but ignores a monthly pace', () => {
    expect(buildLocalPlan(DEFAULT_PROFILE, [], 'Wedding for $30k').thinking_steps[1].title).toContain('$30,000');
    expect(buildLocalPlan(DEFAULT_PROFILE, [], 'Starting a business, saving $3,000/mo').thinking_steps[1].title).not.toContain('$3,000');
  });

  it('shows projected balances that match applying every step', () => {
    const plan = buildLocalPlan(DEFAULT_PROFILE, [], 'Having a baby');
    const applied = applyConfirmedActions(DEFAULT_PROFILE, [], plan.quick_actions.map((_, i) => i), plan.quick_actions);
    const savings = plan.account_impacts.find((impact) => impact.account_name === 'Savings');
    expect(savings?.projected_balance).toBe(applied.profile.savingsBalance);
  });
});

describe('debt plan', () => {
  it('never asks for more per month than the debt can use', () => {
    const plan = buildLocalPlan(DEFAULT_PROFILE, [], 'I want to pay off my credit card');
    const extra = plan.quick_actions.find((action) => action.automation)?.automation?.amount ?? 0;
    expect(extra).toBeLessThanOrEqual(DEFAULT_PROFILE.debtPayments);
  });
});

import { DEFAULT_PROFILE } from '@/lib/defaults';
import type { FinancialProfile } from '@/lib/types';
import type { EvalScenario } from './scenario-schema';

// Each raw response is authored as a plain object then serialised, so the eval
// also exercises parsePathfinderResult / stripMarkdownFences. Some are
// markdown-fenced on purpose. account_impacts is intentionally omitted from the
// raw responses — the engine rebuilds it from real balances, and the eval
// verifies that rebuild.

function profile(overrides: Partial<FinancialProfile>): FinancialProfile {
  return { ...DEFAULT_PROFILE, ...overrides };
}

function json(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function fenced(obj: unknown): string {
  return '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
}

const neutralSummary = {
  income_change: { value: '$0', label: 'No change', type: 'neutral' },
  expense_change: { value: '$0', label: 'No change', type: 'neutral' },
  net_worth_change: { value: '$0', label: 'Placeholder', type: 'neutral' },
  timeline: { value: '12 months', label: 'Plan horizon', type: 'neutral' },
};

export const SCENARIOS: EvalScenario[] = [
  // ── 1. Pay-off with no debt must be removed; generic step filtered ──
  {
    id: 'baby-parental-leave',
    description: 'Baby — RESP + buffer; strips a pay-off with no balance and a generic step',
    lifeEvent: 'Having a baby next spring, plan parental leave and childcare',
    year: 2026,
    profile: profile({ creditCardBalance: 0, savingsBalance: 20000, chequingBalance: 12000 }),
    customFunds: [],
    rawAiResponse: fenced({
      thinking_steps: [
        { title: 'Parental Leave Drop', insights: [{ text: 'EI caps at ~$2,672/mo vs $7.9K income — $5.2K/mo gap', type: 'negative' }] },
        { title: 'RESP Free Money', insights: [{ text: '$2,500/yr earns $500 CESG match', type: 'positive' }] },
        { title: 'Cash Flow Snapshot', insights: [{ text: 'Household nets a healthy monthly surplus', type: 'neutral' }] },
      ],
      impact_summary: neutralSummary,
      quick_actions: [
        { title: 'Move $3,000 from Savings → Baby Buffer', why: 'Pre-funds leave months', derived_from: 'Savings $20K → $3K buffer', type: 'create_fund', amount: 3000, from_account: 'Savings', to_account: 'Baby Buffer', priority: 'do_now' },
        { title: 'Open RESP, auto-deposit $200/mo', why: '20% CESG match', derived_from: '$2,500/yr max → $500 grant', type: 'open_account', to_account: 'RESP', automation: { amount: 200, frequency: 'monthly', duration_months: 12 }, priority: 'this_month' },
        { title: 'Automate $400/mo from Chequing → TFSA', why: 'Tax-free growth', derived_from: 'TFSA room $14K, $400/mo', type: 'automate', from_account: 'Chequing', to_account: 'TFSA', automation: { amount: 400, frequency: 'monthly', duration_months: 12 }, priority: 'this_week' },
        { title: 'Pause $300/mo FHSA contributions', why: 'Redirect to baby costs', derived_from: 'FHSA room carries forward', type: 'pause', amount: 300, from_account: 'FHSA', priority: 'this_week' },
        { title: 'Pay off $3,500 credit card', why: 'Kills ~20% APR', derived_from: '$3,500 at 20% = $700/yr', type: 'pay_off', amount: 3500, from_account: 'Chequing', to_account: 'Credit Card', priority: 'do_now' },
      ],
      advisor_flags: [{ title: 'Update beneficiary', explanation: 'Name your dependent before birth', urgency: 'medium' }],
      risk_warnings: [{ text: 'EI parental benefits cap at ~$668/week', severity: 'medium' }],
      monthly_cashflow: [{ phase: 'Current', amount: 9999 }, { phase: 'On leave', amount: 200 }],
    }),
    expect: {
      maxActions: 4,
      mustRemoveContaining: ['no credit card balance'],
      requireThinkingTitles: ['Parental Leave Drop', 'RESP Free Money'],
      forbidThinkingTitles: ['Cash Flow Snapshot'],
    },
  },

  // ── 2. FHSA deposit for a non-first-time buyer must be removed ──
  {
    id: 'home-not-first-time-buyer',
    description: 'Already a homeowner — FHSA deposit stripped (eligibility)',
    lifeEvent: 'Buying a bigger house and using my FHSA for the down payment',
    year: 2026,
    profile: profile({ housingType: 'own', mortgageBalance: 320000, fhsaBalance: 0, savingsBalance: 25000, chequingBalance: 15000 }),
    customFunds: [],
    rawAiResponse: json({
      thinking_steps: [
        { title: 'Down Payment Gap', insights: [{ text: 'Need ~$100K down on the upsize, have $25K liquid', type: 'negative' }] },
        { title: 'Stress Test Math', insights: [{ text: 'Qualifying rate ~5.25% on the new mortgage', type: 'neutral' }] },
      ],
      impact_summary: neutralSummary,
      quick_actions: [
        { title: 'Move $8,000 from Savings → FHSA', why: 'Tax-free for first home', derived_from: 'FHSA room $8K', type: 'move', amount: 8000, from_account: 'Savings', to_account: 'FHSA', priority: 'do_now' },
        { title: 'Create Down Payment fund — $5,000 from Savings', why: 'Earmark cash', derived_from: 'Savings $25K → $5K', type: 'create_fund', amount: 5000, from_account: 'Savings', to_account: 'Down Payment', priority: 'this_week' },
        { title: 'Move $5,000 from Savings → Non-Registered', why: 'Invest the rest', derived_from: 'Savings surplus $5K', type: 'move', amount: 5000, from_account: 'Savings', to_account: 'Non-Registered', priority: 'this_month' },
      ],
      advisor_flags: [],
      risk_warnings: [{ text: 'Closing costs 1.5-4% are not sheltered', severity: 'high' }],
      monthly_cashflow: [{ phase: 'Current', amount: 8888 }, { phase: 'After move', amount: 5000 }],
    }),
    expect: {
      maxActions: 4,
      mustRemoveContaining: ['not first-time buyer'],
      requireThinkingTitles: ['Down Payment Gap'],
    },
  },

  // ── 3. Over-budget move capped to balance + split into automation ──
  {
    id: 'emergency-overbudget',
    description: 'Asks to move more than exists — capped to balance, shortfall auto-split',
    lifeEvent: 'Build a $30k emergency fund',
    year: 2026,
    profile: profile({ savingsBalance: 8000, chequingBalance: 9000, creditCardBalance: 0 }),
    customFunds: [],
    rawAiResponse: json({
      thinking_steps: [
        { title: 'Emergency Runway', insights: [{ text: '$8K liquid covers ~1.5mo of expenses', type: 'negative' }] },
        { title: 'Net Worth Overview', insights: [{ text: 'Overall balance sheet looks fine', type: 'neutral' }] },
      ],
      impact_summary: neutralSummary,
      quick_actions: [
        { title: 'Move $30,000 from Savings → Emergency Fund', why: 'Full 6-month buffer', derived_from: '$30K target', type: 'move', amount: 30000, from_account: 'Savings', to_account: 'Emergency Fund', priority: 'do_now' },
      ],
      advisor_flags: [],
      risk_warnings: [{ text: 'Keep 3 months liquid at all times', severity: 'low' }],
      monthly_cashflow: [{ phase: 'Current', amount: 7777 }],
    }),
    expect: {
      maxActions: 2,
      requireThinkingTitles: ['Emergency Runway'],
      forbidThinkingTitles: ['Net Worth Overview'],
      expectSplitAutomation: true,
    },
  },

  // ── 4. Goal abandonment — old-goal steps stripped, exit step kept ──
  {
    id: 'abandon-house-purchase',
    description: 'User quits home-buying — abandoned-goal reasoning removed, exit step kept',
    lifeEvent: "I'm done with buying a house, move everything to chequing",
    year: 2026,
    profile: profile({ housingType: 'rent', mortgageBalance: 0, fhsaBalance: 8000, savingsBalance: 12000, chequingBalance: 8000, creditCardBalance: 0 }),
    customFunds: [],
    rawAiResponse: json({
      thinking_steps: [
        { title: 'FHSA Withdrawal Tax', insights: [{ text: 'Withdrawing FHSA outside a home purchase is taxable income', type: 'negative' }] },
        { title: 'Down Payment Gap', insights: [{ text: 'Still $35K short of a 20% down payment', type: 'negative' }] },
        { title: 'Home Buying Feasibility', insights: [{ text: 'Mortgage qualifying looks tight at current rates', type: 'neutral' }] },
      ],
      impact_summary: neutralSummary,
      quick_actions: [
        { title: 'Move $8,000 from FHSA → Chequing', why: 'Consolidate to cash', derived_from: 'FHSA $8K', type: 'move', amount: 8000, from_account: 'FHSA', to_account: 'Chequing', priority: 'do_now' },
        { title: 'Move $5,000 from Savings → Chequing', why: 'Consolidate to cash', derived_from: 'Savings $12K → $5K', type: 'move', amount: 5000, from_account: 'Savings', to_account: 'Chequing', priority: 'this_week' },
      ],
      advisor_flags: [],
      risk_warnings: [{ text: 'FHSA withdrawal may trigger ~$1.7K tax', severity: 'medium' }],
      monthly_cashflow: [{ phase: 'Current', amount: 6666 }, { phase: 'After move', amount: 6666 }],
    }),
    expect: {
      maxActions: 4,
      requireThinkingTitles: ['FHSA Withdrawal Tax'],
      forbidThinkingTitles: ['Down Payment Gap', 'Home Buying Feasibility'],
    },
  },

  // ── 5. Multi-scenario — over-cap action list trimmed to 7 ──
  {
    id: 'multi-baby-house-business',
    description: 'Three sub-situations — eight drafted actions trimmed to the complex cap',
    lifeEvent: 'Having a baby and buying a house and starting a business next year',
    year: 2026,
    profile: profile({
      housingType: 'rent', mortgageBalance: 0, fhsaBalance: 2000,
      chequingBalance: 20000, savingsBalance: 40000, nonRegBalance: 10000,
      tfsaRoom: 20000, rrspRoom: 20000, creditCardBalance: 4000,
    }),
    customFunds: [],
    rawAiResponse: json({
      thinking_steps: [
        { title: 'Parental Leave', insights: [{ text: 'EI replaces ~55% of income during leave', type: 'negative' }] },
        { title: 'Down Payment Gap', insights: [{ text: 'FHSA + HBP gives ~$50K sheltered room', type: 'positive' }] },
        { title: 'Startup Runway', insights: [{ text: '$40K savings covers ~7mo of business burn', type: 'neutral' }] },
        { title: 'Net Worth Check', insights: [{ text: 'Total balance sheet is healthy', type: 'neutral' }] },
      ],
      impact_summary: neutralSummary,
      quick_actions: [
        { title: 'Open RESP, auto-deposit $200/mo', why: 'CESG match', derived_from: '$2,500/yr → $500', type: 'open_account', to_account: 'RESP', automation: { amount: 200, frequency: 'monthly', duration_months: 12 }, priority: 'this_month' },
        { title: 'Move $3,000 from Savings → Baby Fund', why: 'Buffer leave', derived_from: 'Savings $40K → $3K', type: 'create_fund', amount: 3000, from_account: 'Savings', to_account: 'Baby Fund', priority: 'do_now' },
        { title: 'Move $6,000 from Savings → FHSA', why: 'Max first-home room', derived_from: 'FHSA room $6K', type: 'move', amount: 6000, from_account: 'Savings', to_account: 'FHSA', priority: 'do_now' },
        { title: 'Move $5,000 from Savings → Down Payment', why: 'Earmark down payment', derived_from: 'Savings $40K → $5K', type: 'create_fund', amount: 5000, from_account: 'Savings', to_account: 'Down Payment', priority: 'this_week' },
        { title: 'Move $8,000 from Savings → Business Startup', why: 'Seed the business', derived_from: 'Savings → $8K seed', type: 'create_fund', amount: 8000, from_account: 'Savings', to_account: 'Business Startup', priority: 'this_month' },
        { title: 'Pay off $4,000 credit card', why: 'Clears revolving debt', derived_from: '$4K at 20% = $800/yr', type: 'pay_off', amount: 4000, from_account: 'Chequing', to_account: 'Credit Card', priority: 'do_now' },
        { title: 'Automate $500/mo from Chequing → TFSA', why: 'Tax-free growth', derived_from: 'TFSA room $20K', type: 'automate', from_account: 'Chequing', to_account: 'TFSA', automation: { amount: 500, frequency: 'monthly', duration_months: 12 }, priority: 'this_week' },
        { title: 'Move $5,000 from Non-Registered → TFSA', why: 'Shelter gains', derived_from: 'Non-Reg $10K → $5K', type: 'move', amount: 5000, from_account: 'Non-Registered', to_account: 'TFSA', priority: 'next_quarter' },
      ],
      advisor_flags: [{ title: 'Sequence the goals', explanation: 'Competing cash needs across baby, house, business', urgency: 'high' }],
      risk_warnings: [{ text: 'Three big goals in one year strains cashflow', severity: 'high' }],
      monthly_cashflow: [{ phase: 'Current', amount: 5555 }, { phase: 'On leave', amount: 1000 }, { phase: 'Business ramp', amount: -500 }],
    }),
    expect: {
      maxActions: 7,
      requireThinkingTitles: ['Parental Leave', 'Down Payment Gap', 'Startup Runway'],
      forbidThinkingTitles: ['Net Worth Check'],
    },
  },

  // ── 6. Simple TFSA — destination capped to room, list trimmed to 2 ──
  {
    id: 'tfsa-room-overflow',
    description: 'Deposit above TFSA room capped; simple prompt trims action list to 2',
    lifeEvent: 'Max out my TFSA',
    year: 2026,
    profile: profile({ tfsaBalance: 30000, tfsaRoom: 3000, savingsBalance: 20000, chequingBalance: 9000, creditCardBalance: 0 }),
    customFunds: [],
    rawAiResponse: json({
      thinking_steps: [
        { title: 'TFSA Headroom', insights: [{ text: 'Only $3K room left to fill this year', type: 'neutral' }] },
        { title: 'Cash Flow Analysis', insights: [{ text: 'Income comfortably exceeds expenses', type: 'positive' }] },
      ],
      impact_summary: neutralSummary,
      quick_actions: [
        { title: 'Move $10,000 from Savings → TFSA', why: 'Fill tax-free room', derived_from: 'TFSA room', type: 'move', amount: 10000, from_account: 'Savings', to_account: 'TFSA', priority: 'do_now' },
        { title: 'Move $4,000 from Savings → Non-Registered', why: 'Invest overflow', derived_from: 'Savings $20K → $4K', type: 'move', amount: 4000, from_account: 'Savings', to_account: 'Non-Registered', priority: 'this_week' },
        { title: 'Automate $300/mo from Chequing → TFSA', why: 'Top up monthly', derived_from: '$300/mo', type: 'automate', from_account: 'Chequing', to_account: 'TFSA', automation: { amount: 300, frequency: 'monthly', duration_months: 12 }, priority: 'this_month' },
      ],
      advisor_flags: [],
      risk_warnings: [{ text: 'Avoid over-contributing — 1%/mo penalty', severity: 'medium' }],
      monthly_cashflow: [{ phase: 'Current', amount: 4444 }],
    }),
    expect: {
      maxActions: 2,
      requireThinkingTitles: ['TFSA Headroom'],
      forbidThinkingTitles: ['Cash Flow Analysis'],
    },
  },
];

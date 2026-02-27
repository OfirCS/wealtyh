import type { FinancialProfile, SuggestionChip } from './types';

// ===== Default Financial Profile (editable starting values) =====

export const DEFAULT_PROFILE: FinancialProfile = {
  annualIncome: 85000,
  employmentType: 'employed',
  partnerIncome: 65000,
  province: 'ON',

  chequingBalance: 12400,
  savingsBalance: 18000,
  tfsaBalance: 34500,
  tfsaRoom: 7000,
  rrspBalance: 22000,
  rrspRoom: 15200,
  fhsaBalance: 0,
  nonRegBalance: 8000,

  housingType: 'rent',
  housingExpense: 2200,
  mortgageBalance: 0,

  essentialExpenses: 1800,
  discretionarySpending: 800,
  debtPayments: 400,
};

// ===== Suggestion Chips =====

export const SUGGESTION_CHIPS: SuggestionChip[] = [
  {
    emoji: '\uD83C\uDF7C',
    label: 'Having a baby',
    prompt:
      "We're having a baby and thinking about how to prepare financially...",
  },
  {
    emoji: '\uD83C\uDFE0',
    label: 'Buying a home',
    prompt:
      "I'm looking to buy my first home around $500-700K...",
  },
  {
    emoji: '\u2708\uFE0F',
    label: 'Career break',
    prompt:
      'I want to take a year off work to travel and recharge...',
  },
  {
    emoji: '\uD83D\uDCBC',
    label: 'Starting a business',
    prompt:
      "I'm thinking about quitting my job to start my own business...",
  },
  {
    emoji: '\uD83C\uDF93',
    label: 'Back to school',
    prompt:
      "I'm considering going back to school for a 2-year program...",
  },
  {
    emoji: '\uD83D\uDC4B',
    label: 'Leaving my job',
    prompt:
      "I'm planning to leave my job and freelance...",
  },
];

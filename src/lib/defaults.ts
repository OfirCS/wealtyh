import { computeDerivedMetrics, getCanadianRuleSet } from './prompts';
import type { FinancialProfile, SuggestionChip, CustomFund } from './types';

// ===== Default Financial Profile =====
// Empty by default — the onboarding wizard fills in real numbers from the user.
// This makes sure no visitor lands on someone else's hardcoded balances.

export const DEFAULT_PROFILE: FinancialProfile = {
  annualIncome: 0,
  employmentType: 'employed',
  partnerIncome: 0,
  province: 'ON',

  chequingBalance: 0,
  savingsBalance: 0,
  tfsaBalance: 0,
  tfsaRoom: 7000,
  rrspBalance: 0,
  rrspRoom: 0,
  fhsaBalance: 0,
  nonRegBalance: 0,

  housingType: 'rent',
  housingExpense: 0,
  mortgageBalance: 0,

  essentialExpenses: 0,
  discretionarySpending: 0,
  debtPayments: 0,
  creditCardBalance: 0,
};

// ===== Dynamic Suggestion Chips =====

interface ScoredChip extends SuggestionChip {
  score: number;
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString('en-CA')}`;
}

function pushChip(chips: ScoredChip[], chip: ScoredChip) {
  if (chips.some((c) => c.label === chip.label)) return;
  chips.push(chip);
}

export function getDynamicSuggestionChips(
  profile: FinancialProfile,
  customFunds: CustomFund[] = [],
  limit = 6,
): SuggestionChip[] {
  const m = computeDerivedMetrics(profile, customFunds);
  const rules = getCanadianRuleSet();
  const chips: ScoredChip[] = [];
  const householdIncome = profile.annualIncome + profile.partnerIncome;
  const fhsaRoom = m.isFirstTimeBuyer ? Math.max(0, rules.fhsaAnnualRoom - profile.fhsaBalance) : 0;
  const emergencyTarget = m.totalMonthlyExpenses * 3;
  const emergencyGap = Math.max(0, emergencyTarget - m.liquidAssets);
  const topCustomFund = [...customFunds].sort((a, b) => b.balance - a.balance)[0];

  if (profile.creditCardBalance > 0) {
    pushChip(chips, {
      emoji: '\uD83D\uDCB3',
      label: 'Pay off debt',
      prompt: `I have ${fmt(profile.creditCardBalance)} credit card debt — help me pay it off.`,
      score: 100,
    });
  }

  if (m.emergencyFundMonths < 3) {
    pushChip(chips, {
      emoji: '\uD83D\uDEE1\uFE0F',
      label: 'Emergency buffer',
      prompt: `Build a ${fmt(Math.max(0, emergencyGap))} emergency buffer — 3 months of expenses.`,
      score: 95,
    });
  }

  if (m.isFirstTimeBuyer) {
    pushChip(chips, {
      emoji: '\uD83C\uDFE0',
      label: 'Buy first home',
      prompt: `Buying my first home — ${fmt(fhsaRoom)} FHSA room available.`,
      score: 90,
    });
  }

  if (profile.tfsaRoom > 0) {
    pushChip(chips, {
      emoji: '\uD83D\uDCC8',
      label: 'Use TFSA room',
      prompt: `Use my ${fmt(profile.tfsaRoom)} TFSA room with monthly surplus.`,
      score: m.monthlySurplus > 0 ? 88 : 70,
    });
  }

  if (profile.rrspRoom > 0 && householdIncome >= 100000) {
    pushChip(chips, {
      emoji: '\uD83E\uDDFE',
      label: 'RRSP tax plan',
      prompt: `${fmt(profile.rrspRoom)} RRSP room — optimize for tax savings.`,
      score: 78,
    });
  }

  if (m.monthlySurplus > 500) {
    pushChip(chips, {
      emoji: '\uD83D\uDCBC',
      label: 'Start a business',
      prompt: `Starting a business — saving ${fmt(m.monthlySurplus)}/mo.`,
      score: 72,
    });
  }

  if (topCustomFund) {
    pushChip(chips, {
      emoji: topCustomFund.emoji || '\u{1F4B0}',
      label: `Top up ${topCustomFund.name}`,
      prompt: `Grow "${topCustomFund.name}" from ${fmt(topCustomFund.balance)}.`,
      score: 76,
    });
  }

  pushChip(chips, {
    emoji: '\uD83C\uDF7C',
    label: 'Having a baby',
    prompt: "Having a baby — plan cashflow, RESP, and leave.",
    score: 68,
  });

  pushChip(chips, {
    emoji: '\u2708\uFE0F',
    label: 'Career break',
    prompt: `Career break — how long will ${fmt(m.liquidAssets)} last?`,
    score: 66,
  });

  pushChip(chips, {
    emoji: '\uD83C\uDF93',
    label: 'Back to school',
    prompt: `Going back to school — plan tuition and cashflow.`,
    score: 64,
  });

  return chips
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((chip) => ({
      emoji: chip.emoji,
      label: chip.label,
      prompt: chip.prompt,
    }));
}

export const SUGGESTION_CHIPS: SuggestionChip[] = getDynamicSuggestionChips(DEFAULT_PROFILE, []);

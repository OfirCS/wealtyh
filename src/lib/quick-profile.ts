import type { Budget } from './budget';
import { profileWithBudget, totalPlanned } from './budget';
import { DEFAULT_PROFILE } from './defaults';
import { grossFromTakeHome } from './money';
import { getCanadianRuleSet } from './prompts';
import type { FinancialProfile } from './types';

/** The handful of answers the first-run questions collect. */
export interface QuickAnswers {
  income: number;
  partnerIncome: number;
  housingType: FinancialProfile['housingType'];
  housingCost: number;
  otherSpending: number;
  cash: number;
  tfsa: number;
  rrsp: number;
  fhsa: number;
  creditCard: number;
}

export const EMPTY_ANSWERS: QuickAnswers = {
  income: 0,
  partnerIncome: 0,
  housingType: 'rent',
  housingCost: 0,
  otherSpending: 0,
  cash: 0,
  tfsa: 0,
  rrsp: 0,
  fhsa: 0,
  creditCard: 0,
};

/** How one "everything else" figure is split. Editable afterwards in "Your numbers". */
const ESSENTIAL_SHARE = 0.7;

/** Expands the short answers into a full profile using sensible, editable assumptions. */
export function profileFromAnswers(answers: QuickAnswers): FinancialProfile {
  const rules = getCanadianRuleSet();
  const monthlySpend = answers.housingCost + answers.otherSpending;
  const chequing = Math.min(answers.cash, monthlySpend);
  const essentials = Math.round(answers.otherSpending * ESSENTIAL_SHARE);

  return {
    ...DEFAULT_PROFILE,
    annualIncome: answers.income,
    partnerIncome: answers.partnerIncome,
    chequingBalance: chequing,
    savingsBalance: answers.cash - chequing,
    tfsaBalance: answers.tfsa,
    tfsaRoom: rules.tfsaAnnualRoom,
    rrspBalance: answers.rrsp,
    rrspRoom: Math.min(Math.round(answers.income * 0.18), rules.rrspMaxAnnual),
    fhsaBalance: answers.fhsa,
    nonRegBalance: 0,
    housingType: answers.housingType,
    housingExpense: answers.housingCost,
    mortgageBalance: 0,
    essentialExpenses: essentials,
    discretionarySpending: answers.otherSpending - essentials,
    debtPayments: 0,
    creditCardBalance: answers.creditCard,
  };
}

/** What a connected budget already tells us, so those questions never get asked. */
export function answersFromBudget(budget: Budget): QuickAnswers {
  const housing = budget.categories.find((category) => category.id === 'housing')?.planned ?? 0;
  return {
    ...EMPTY_ANSWERS,
    income: grossFromTakeHome(budget.income * 12),
    housingCost: housing,
    otherSpending: totalPlanned(budget) - housing,
  };
}

/** Combines the few remaining answers with real spending from the budget. */
export function profileFromConnection(answers: QuickAnswers, budget: Budget): FinancialProfile {
  return profileWithBudget(profileFromAnswers(answers), budget);
}

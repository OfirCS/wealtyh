import type { CustomFund, FinancialProfile } from './types';

// Rough share of gross income lost to income tax, CPP and EI, blended across
// provinces. Good enough to show a realistic "left over" figure; not a tax calc.
const DEDUCTION_CURVE: [income: number, rate: number][] = [
  [0, 0],
  [20_000, 0.1],
  [50_000, 0.21],
  [85_000, 0.26],
  [150_000, 0.32],
  [250_000, 0.38],
  [500_000, 0.45],
];

function deductionRate(annualGross: number): number {
  for (let i = 1; i < DEDUCTION_CURVE.length; i++) {
    const [x1, y1] = DEDUCTION_CURVE[i];
    if (annualGross <= x1) {
      const [x0, y0] = DEDUCTION_CURVE[i - 1];
      return y0 + ((annualGross - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return DEDUCTION_CURVE[DEDUCTION_CURVE.length - 1][1];
}

/** Estimated annual take-home pay for one earner. */
export function estimateTakeHome(annualGross: number): number {
  if (annualGross <= 0) return 0;
  return annualGross * (1 - deductionRate(annualGross));
}

/** Works backwards from take-home pay to the gross income that would produce it. */
export function grossFromTakeHome(annualTakeHome: number): number {
  if (annualTakeHome <= 0) return 0;
  let low = annualTakeHome;
  let high = annualTakeHome * 2.5;
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    if (estimateTakeHome(middle) < annualTakeHome) low = middle;
    else high = middle;
  }
  return Math.round((low + high) / 2);
}

export interface MoneyPicture {
  /** Cash + investments + funds, minus credit card. Mortgage excluded: home value isn't an input. */
  totalMoney: number;
  cash: number;
  monthlyTakeHome: number;
  monthlySpend: number;
  /** Take-home minus spending. Negative means the household is running short. */
  leftOver: number;
  runwayMonths: number;
}

export function getMoneyPicture(profile: FinancialProfile, customFunds: CustomFund[] = []): MoneyPicture {
  const cash = profile.chequingBalance + profile.savingsBalance;
  const invested = profile.tfsaBalance + profile.rrspBalance + profile.fhsaBalance + profile.nonRegBalance;
  const funds = customFunds.reduce((sum, fund) => sum + Math.max(0, fund.balance), 0);
  const monthlyTakeHome = (estimateTakeHome(profile.annualIncome) + estimateTakeHome(profile.partnerIncome)) / 12;
  const monthlySpend =
    profile.housingExpense + profile.essentialExpenses + profile.discretionarySpending + profile.debtPayments;

  return {
    totalMoney: cash + invested + funds - profile.creditCardBalance,
    cash,
    monthlyTakeHome,
    monthlySpend,
    leftOver: monthlyTakeHome - monthlySpend,
    runwayMonths: monthlySpend > 0 ? cash / monthlySpend : 0,
  };
}

export function formatMoney(value: number): string {
  const rounded = Math.round(Math.abs(value));
  return `${value < 0 ? '−' : ''}$${rounded.toLocaleString('en-CA')}`;
}

export function formatSigned(value: number): string {
  return `${value < 0 ? '−' : '+'}$${Math.round(Math.abs(value)).toLocaleString('en-CA')}`;
}

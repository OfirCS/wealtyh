import { describe, expect, it } from 'vitest';
import { getMoneyPicture } from '@/lib/money';
import { EMPTY_ANSWERS, profileFromAnswers } from '@/lib/quick-profile';

const ANSWERS = {
  ...EMPTY_ANSWERS,
  income: 80000,
  housingCost: 2000,
  otherSpending: 1500,
  cash: 10000,
  tfsa: 5000,
  creditCard: 1000,
};

describe('profileFromAnswers', () => {
  it('keeps every dollar the user entered', () => {
    const profile = profileFromAnswers(ANSWERS);
    expect(profile.chequingBalance + profile.savingsBalance).toBe(10000);
    expect(profile.essentialExpenses + profile.discretionarySpending).toBe(1500);
    expect(getMoneyPicture(profile).monthlySpend).toBe(3500);
  });

  it('never carries over sample numbers the user did not enter', () => {
    const profile = profileFromAnswers(EMPTY_ANSWERS);
    expect(getMoneyPicture(profile).totalMoney).toBe(0);
    expect(profile.partnerIncome).toBe(0);
    expect(profile.nonRegBalance).toBe(0);
    expect(profile.debtPayments).toBe(0);
  });

  it('caps assumed RRSP room at the annual limit', () => {
    expect(profileFromAnswers({ ...ANSWERS, income: 60000 }).rrspRoom).toBe(10800);
    expect(profileFromAnswers({ ...ANSWERS, income: 900000 }).rrspRoom).toBeLessThan(162000);
  });
});

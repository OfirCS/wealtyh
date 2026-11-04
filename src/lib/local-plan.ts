import { applyConfirmedActions } from './apply-actions';
import type { StreamEvent } from './claude';
import { estimateTakeHome, formatMoney, formatSigned, getMoneyPicture } from './money';
import type { MoneyPicture } from './money';
import { computeDerivedMetrics, getCanadianRuleSet } from './prompts';
import type { CanadianRuleSet } from './prompts';
import type {
  AccountImpact,
  AdvisorFlag,
  CashflowPoint,
  CustomFund,
  DebugLog,
  FinancialProfile,
  ImpactSummary,
  PathfinderResult,
  QuickAction,
  RiskWarning,
  ThinkingStep,
} from './types';

// Built-in planner. It runs with no AI key and no network, using only the
// user's real numbers and the Canadian rule set, so every figure it prints can
// be traced back to something they typed. It never reads live rates.

export type PlanKind = 'baby' | 'home' | 'job' | 'break' | 'debt' | 'buffer' | 'goal' | 'general';

const MATCHERS: [PlanKind, RegExp][] = [
  ['baby', /\b(baby|pregnan\w*|parental leave|maternity|paternity|newborn|expecting)\b/i],
  ['home', /\b(first home|buy(ing)? (a |my |our )?(first )?(home|house|condo)|down payment|fhsa)\b/i],
  ['job', /\b(laid off|layoff|lost my job|losing my job|fired|unemployed|severance)\b/i],
  ['break', /\b(career break|sabbatical|time off|mini.?retire\w*|quit\w*|gap year|burnout)\b/i],
  ['debt', /\b(debt|credit card|pay off|payoff|loans?)\b/i],
  ['buffer', /\b(emergency|buffer|rainy day|safety net)\b/i],
  ['goal', /\b(school|tuition|degree|college|university|business|startup|wedding|car|truck|renovat\w*|moving|vacation|trip|travel)\b/i],
];

const KIND_LABELS: Record<PlanKind, string> = {
  baby: 'a new baby',
  home: 'buying a first home',
  job: 'losing income',
  break: 'a career break',
  debt: 'paying off debt',
  buffer: 'an emergency fund',
  goal: 'saving for a goal',
  general: 'tidying up your money',
};

const GOAL_FUNDS: [RegExp, string][] = [
  [/school|tuition|degree|college|university/i, 'School Fund'],
  [/business|startup/i, 'Business Fund'],
  [/wedding/i, 'Wedding Fund'],
  [/car|truck/i, 'Car Fund'],
  [/renovat/i, 'Renovation Fund'],
  [/moving/i, 'Moving Fund'],
  [/vacation|trip|travel/i, 'Trip Fund'],
];

/** Assumed monthly childcare cost once a parent returns to work. */
const CHILDCARE_MONTHLY = 1200;
/** EI replaces 55% of earnings, capped at the weekly maximum. */
const EI_RATE = 0.55;
const CHEQUING_FLOOR = 500;

export function detectPlanKind(event: string): PlanKind {
  return MATCHERS.find(([, pattern]) => pattern.test(event))?.[0] ?? 'general';
}

function parseMonths(event: string): number | null {
  const months = event.match(/(\d+)[\s-]*(?:months?|mos?)\b/i);
  if (months) return Math.max(1, Number(months[1]));
  const years = event.match(/(\d+)[\s-]*years?\b/i);
  if (years) return Math.max(1, Number(years[1]) * 12);
  return null;
}

function parseTarget(event: string): number | null {
  // "$5,000/mo" is a pace, not a target
  const match = event.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(k)?\b(?!\s*\/)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, '')) * (match[2] ? 1000 : 1);
  return value > 0 ? value : null;
}

function monthCount(value: number): string {
  return `${value} month${value === 1 ? '' : 's'}`;
}

function roundDown(value: number, to: number): number {
  return Math.floor(value / to) * to;
}

interface PlanContext {
  profile: FinancialProfile;
  funds: CustomFund[];
  event: string;
  money: MoneyPicture;
  rules: CanadianRuleSet;
  /** Cash that can move while still leaving one month of spending in place. */
  freeCash: number;
  savingsFree: number;
  chequingFree: number;
  /** Monthly room not yet committed to an automation. */
  monthlyFree: number;
  actions: QuickAction[];
}

function createContext(profile: FinancialProfile, funds: CustomFund[], event: string): PlanContext {
  const money = getMoneyPicture(profile, funds);
  return {
    profile,
    funds,
    event,
    money,
    rules: getCanadianRuleSet(),
    freeCash: Math.max(0, money.cash - money.monthlySpend),
    savingsFree: profile.savingsBalance,
    chequingFree: Math.max(0, profile.chequingBalance - CHEQUING_FLOOR),
    monthlyFree: Math.max(0, money.leftOver),
    actions: [],
  };
}

/** Reserves one lump sum from a single account. Returns null if too little is free. */
function takeCash(ctx: PlanContext, want: number): { from: 'Savings' | 'Chequing'; amount: number } | null {
  const from = ctx.savingsFree >= ctx.chequingFree ? 'Savings' : 'Chequing';
  const available = Math.min(from === 'Savings' ? ctx.savingsFree : ctx.chequingFree, ctx.freeCash);
  const amount = roundDown(Math.min(want, available), 50);
  if (amount < 100) return null;

  ctx.freeCash -= amount;
  if (from === 'Savings') ctx.savingsFree -= amount;
  else ctx.chequingFree -= amount;
  return { from, amount };
}

/** Commits part of the monthly left-over. Returns 0 if there's nothing useful to commit. */
function commitMonthly(ctx: PlanContext, want: number): number {
  const amount = roundDown(Math.min(want, ctx.monthlyFree), 25);
  if (amount < 25) return 0;
  ctx.monthlyFree -= amount;
  return amount;
}

function payCard(ctx: PlanContext, priority: QuickAction['priority'] = 'do_now'): number {
  const owed = ctx.profile.creditCardBalance;
  if (owed <= 0) return 0;
  const cash = takeCash(ctx, owed);
  if (!cash) return 0;
  const amount = Math.min(cash.amount, owed);
  ctx.actions.push({
    title: amount >= owed ? 'Pay off your credit card' : `Pay ${formatMoney(amount)} toward your credit card`,
    why: 'Card interest is around 20% a year. Clearing it beats any investment.',
    derived_from: `You owe ${formatMoney(owed)}. Paying from ${cash.from} still leaves a month of spending in the bank.`,
    type: 'pay_off',
    amount,
    from_account: cash.from,
    to_account: 'Credit card',
    priority,
  });
  return amount;
}

function addFund(ctx: PlanContext, name: string, want: number, why: string, priority: QuickAction['priority'] = 'do_now'): number {
  const cash = takeCash(ctx, want);
  if (!cash) return 0;
  ctx.actions.push({
    title: `Put ${formatMoney(cash.amount)} in a new ${name}`,
    why,
    derived_from: `You need about ${formatMoney(want)}. ${formatMoney(cash.amount)} is free in ${cash.from} after keeping a month of spending.`,
    type: 'create_fund',
    amount: cash.amount,
    from_account: cash.from,
    to_account: name,
    priority,
  });
  return cash.amount;
}

function addAutomation(
  ctx: PlanContext,
  title: (amount: number) => string,
  to: string,
  want: number,
  why: string,
  options: { target?: number; priority?: QuickAction['priority'] } = {},
): number {
  const amount = commitMonthly(ctx, want);
  if (!amount) return 0;
  ctx.actions.push({
    title: title(amount),
    why,
    derived_from: `You have about ${formatMoney(ctx.money.leftOver)} left each month after tax and bills.`,
    type: 'automate',
    from_account: 'Chequing',
    to_account: to,
    automation: {
      amount,
      frequency: 'monthly',
      duration_months: options.target ? Math.ceil(options.target / amount) : undefined,
      target_amount: options.target,
    },
    priority: options.priority ?? 'this_month',
  });
  return amount;
}

function addNote(
  ctx: PlanContext,
  type: 'adjust' | 'pause',
  title: string,
  why: string,
  priority: QuickAction['priority'] = 'this_month',
) {
  ctx.actions.push({ title, why, derived_from: 'Based on your monthly numbers.', type, priority });
}

interface Scenario {
  title: string;
  insights: ThinkingStep['insights'];
  impact: ImpactSummary;
  cashflow: CashflowPoint[];
  flags?: AdvisorFlag[];
  risks?: RiskWarning[];
}

function card(value: string, label: string, type: 'positive' | 'negative' | 'neutral' = 'neutral') {
  return { value, label, type };
}

function perMonth(value: number): string {
  return `${formatSigned(value)} a month`;
}

function babyScenario(ctx: PlanContext): Scenario {
  const { profile, rules, money } = ctx;
  const ei = Math.min((profile.annualIncome * EI_RATE) / 12, (rules.eiParentalMaxWeekly * 52) / 12);
  const takeHome = estimateTakeHome(profile.annualIncome) / 12;
  const dip = Math.max(0, takeHome - ei);

  payCard(ctx);
  addFund(ctx, 'Baby Fund', dip * 3, 'Covers your first three months on leave, while your income settles.');
  const resp = Math.round(rules.respAnnualContributionForMaxCesg / 12);
  const respMonthly = commitMonthly(ctx, resp);
  if (respMonthly) {
    ctx.actions.push({
      title: `Save ${formatMoney(respMonthly)} a month for your child's education`,
      why: `In an RESP, the government adds 20%, up to ${formatMoney(rules.cesgAnnualMax)} a year.`,
      derived_from: `Saving ${formatMoney(rules.respAnnualContributionForMaxCesg)} a year earns the full amount. That's ${formatMoney(resp)} a month.`,
      type: 'open_account',
      amount: respMonthly,
      from_account: 'Chequing',
      to_account: 'RESP',
      automation: { amount: respMonthly, frequency: 'monthly' },
      priority: 'this_month',
    });
  }
  addNote(ctx, 'adjust', 'Find out what childcare costs near you', `This plan guesses ${formatMoney(CHILDCARE_MONTHLY)} a month. The real cost varies a lot by province.`);

  const onLeave = money.leftOver - dip;
  const withCare = money.leftOver - CHILDCARE_MONTHLY;
  return {
    title: 'What a baby changes',
    insights: [
      { text: `On leave, Employment Insurance pays about ${formatMoney(ei)} a month. You bring home ${formatMoney(takeHome)} now.`, type: 'negative' },
      { text: "The Canada Child Benefit isn't counted here, so you may get more.", type: 'positive' },
    ],
    impact: {
      income_change: card(perMonth(-dip), 'Less income while on leave', 'negative'),
      expense_change: card(perMonth(CHILDCARE_MONTHLY), 'More spending once childcare starts', 'negative'),
      net_worth_change: card(formatSigned(-dip * 12), 'Less income over a 12-month leave', 'negative'),
      timeline: card('18 months', 'How long this plan covers'),
    },
    cashflow: [
      { phase: 'Today', amount: money.leftOver },
      { phase: 'On leave', amount: onLeave },
      { phase: 'Back at work', amount: withCare },
    ],
    flags: [{
      title: 'Ask HR about a top-up',
      explanation: 'Some employers add to your pay during leave. It could change this plan a lot.',
      urgency: 'medium',
    }],
    risks: onLeave < 0
      ? [{ text: `You'd be about ${formatMoney(-onLeave)} a month short on leave. Savings will need to cover that.`, severity: 'high' }]
      : [],
  };
}

function homeScenario(ctx: PlanContext): Scenario {
  const { profile, funds, rules, money } = ctx;
  const household = profile.annualIncome + profile.partnerIncome;
  const price = Math.round((household * 4) / 10_000) * 10_000;
  const down = price * 0.1;
  const saved = profile.savingsBalance + profile.tfsaBalance + profile.fhsaBalance
    + funds.reduce((sum, fund) => sum + fund.balance, 0);
  const gap = Math.max(0, down - saved);

  payCard(ctx);

  const fhsaRoom = Math.max(0, rules.fhsaAnnualRoom - profile.fhsaBalance);
  const firstBuyer = profile.housingType === 'rent' && profile.mortgageBalance === 0;
  if (firstBuyer && fhsaRoom > 0) {
    const cash = takeCash(ctx, fhsaRoom);
    if (cash) {
      ctx.actions.push({
        title: `Move ${formatMoney(cash.amount)} into an FHSA`,
        why: "It lowers your taxes now, and it's tax-free when you buy your first home.",
        derived_from: `You can add up to ${formatMoney(fhsaRoom)} this year.`,
        type: 'move',
        amount: cash.amount,
        from_account: cash.from,
        to_account: 'FHSA',
        priority: 'this_week',
      });
    }
  }

  const monthly = addAutomation(
    ctx,
    (amount) => `Save ${formatMoney(amount)} a month for your down payment`,
    'Down Payment Fund',
    money.leftOver * 0.6,
    'Automatic saving keeps you on track without thinking about it.',
    { target: gap > 0 ? gap : undefined },
  );
  const months = monthly > 0 ? Math.ceil(gap / monthly) : 0;

  // 25-year mortgage at an assumed 5%, plus about 1% of the price each year for tax and upkeep
  const rate = 0.05 / 12;
  const payments = 25 * 12;
  const loan = price - down;
  const payment = loan > 0 ? (loan * rate) / (1 - (1 + rate) ** -payments) : 0;
  const upkeep = (price * 0.01) / 12;
  const housingChange = payment + upkeep - profile.housingExpense;

  return {
    title: 'What a first home takes',
    insights: [
      { text: `A home around ${formatMoney(price)} needs about ${formatMoney(down)} down. That price is about four times your household income.`, type: 'neutral' },
      { text: gap > 0 ? `You've saved ${formatMoney(saved)} so far, so you need ${formatMoney(gap)} more.` : `You've already saved ${formatMoney(saved)}. That's enough for 10% down.`, type: gap > 0 ? 'negative' : 'positive' },
    ],
    impact: {
      income_change: card('$0', 'No change to your income'),
      expense_change: card(perMonth(housingChange), 'Housing cost change after you move in', housingChange > 0 ? 'negative' : 'positive'),
      net_worth_change: card(formatMoney(down), 'Down payment to save'),
      timeline: card(gap === 0 ? 'Ready now' : months > 0 ? monthCount(months) : 'Not yet', 'Until you have it, at this pace'),
    },
    cashflow: [
      { phase: 'Today', amount: money.leftOver },
      { phase: 'While saving', amount: money.leftOver - monthly },
      { phase: 'After you move in', amount: money.leftOver - housingChange },
    ],
    flags: [{
      title: "Look into the Home Buyers' Plan",
      explanation: `First-time buyers can borrow up to ${formatMoney(rules.hbpMax)} from their own RRSP for a home, then pay it back over time.`,
      urgency: 'low',
    }],
    risks: money.leftOver - housingChange < 0
      ? [{ text: `A ${formatMoney(price)} home would leave you about ${formatMoney(housingChange - money.leftOver)} a month short.`, severity: 'high' }]
      : [],
  };
}

function breakScenario(ctx: PlanContext): Scenario {
  const { profile, money } = ctx;
  const months = parseMonths(ctx.event) ?? 6;
  const partner = estimateTakeHome(profile.partnerIncome) / 12;
  const takeHome = estimateTakeHome(profile.annualIncome) / 12;
  const shortfall = Math.max(0, money.monthlySpend - partner);
  const need = shortfall * months;

  const funded = addFund(ctx, 'Career Break Fund', need, partner > 0 ? `Covers ${monthCount(months)} of bills your partner's income won't.` : `Covers ${monthCount(months)} of bills while you're off.`);
  const gap = Math.max(0, need - funded);
  const monthly = gap > 0
    ? addAutomation(ctx, (amount) => `Save ${formatMoney(amount)} a month before you stop working`, 'Career Break Fund', money.leftOver * 0.7, "The more you save now, the less you'll spend later.", { target: gap, priority: 'this_week' })
    : 0;
  const lead = monthly > 0 ? Math.ceil(gap / monthly) : 0;

  if (profile.rrspBalance > 0) {
    addNote(ctx, 'pause', "Pause RRSP contributions while you're off", 'That room saves you more tax in a year when you earn more.');
  }
  const trim = roundDown(profile.discretionarySpending * 0.5, 25);
  if (trim > 0) {
    addNote(ctx, 'adjust', `Spend ${formatMoney(trim)} less a month on fun while you're off`, 'Cutting your fun budget in half makes your money last longer.');
  }

  return {
    title: `What ${monthCount(months)} off costs`,
    insights: [
      { text: `With no paycheque, about ${formatMoney(shortfall)} a month comes out of your savings.`, type: 'negative' },
      { text: gap > 0 ? `That's ${formatMoney(need)} in total, and ${formatMoney(gap)} isn't saved yet.` : `That's ${formatMoney(need)} in total, and you can cover all of it today.`, type: gap > 0 ? 'negative' : 'positive' },
    ],
    impact: {
      income_change: card(perMonth(-takeHome), 'Less income during the break', 'negative'),
      expense_change: card('$0', 'No change to your spending'),
      net_worth_change: card(formatSigned(-need), 'Comes out of savings', 'negative'),
      timeline: card(monthCount(lead + months), lead > 0 ? `${monthCount(lead)} saving first` : 'Can start any time'),
    },
    cashflow: [
      { phase: 'Today', amount: money.leftOver },
      { phase: 'During the break', amount: partner - money.monthlySpend },
      { phase: 'Back at work', amount: money.leftOver },
    ],
    flags: [{
      title: 'Check your benefits before you go',
      explanation: 'Health coverage and employer RRSP matching often stop when work stops.',
      urgency: 'medium',
    }],
    risks: gap > 0 && monthly === 0
      ? [{ text: `You can't cover this break yet, and there's nothing left each month to save.`, severity: 'high' }]
      : [],
  };
}

function jobScenario(ctx: PlanContext): Scenario {
  const { profile, rules, money } = ctx;
  const ei = Math.min((profile.annualIncome * EI_RATE) / 12, (rules.eiParentalMaxWeekly * 52) / 12);
  const partner = estimateTakeHome(profile.partnerIncome) / 12;
  const takeHome = estimateTakeHome(profile.annualIncome) / 12;
  const onEi = ei + partner - money.monthlySpend;
  const noEi = partner - money.monthlySpend;
  const burn = Math.max(0, -onEi);
  const runway = burn > 0 ? money.cash / burn : null;

  addNote(ctx, 'adjust', 'Apply for Employment Insurance this week', 'Waiting can cost you weeks of benefits.', 'do_now');
  const trim = roundDown(profile.discretionarySpending * 0.6, 25);
  if (trim > 0) {
    addNote(ctx, 'adjust', `Spend ${formatMoney(trim)} less a month on fun for now`, 'The fastest way to make your cash last.', 'do_now');
  }
  if (profile.tfsaBalance + profile.rrspBalance > 0) {
    addNote(ctx, 'pause', 'Pause investing until you have income again', 'Right now, cash matters more than growth.', 'this_week');
  }

  return {
    title: 'How long your cash lasts',
    insights: [
      { text: `Employment Insurance pays up to about ${formatMoney(ei)} a month. You bring home ${formatMoney(takeHome)} now.`, type: 'negative' },
      { text: runway ? `At that pace, your ${formatMoney(money.cash)} in the bank lasts about ${runway.toFixed(1)} months.` : 'Employment Insurance and other household income would cover your bills for now.', type: runway && runway < 6 ? 'negative' : 'positive' },
    ],
    impact: {
      income_change: card(perMonth(ei - takeHome), 'Less income while on benefits', 'negative'),
      expense_change: card(trim > 0 ? perMonth(-trim) : '$0', 'If you spend less on fun', trim > 0 ? 'positive' : 'neutral'),
      net_worth_change: card(burn > 0 ? perMonth(-burn) : '$0', 'Comes out of savings', burn > 0 ? 'negative' : 'neutral'),
      timeline: card(runway ? `${runway.toFixed(1)} months` : 'Stable', 'How long your cash lasts'),
    },
    cashflow: [
      { phase: 'Today', amount: money.leftOver },
      { phase: 'On benefits', amount: onEi },
      { phase: 'If benefits end', amount: noEi },
      { phase: 'New job', amount: money.leftOver },
    ],
    flags: [{
      title: 'Ask about severance before you sign',
      explanation: 'Severance can often be negotiated. Get advice before you accept.',
      urgency: 'high',
    }],
    risks: [],
  };
}

function debtScenario(ctx: PlanContext): Scenario {
  const { profile, money } = ctx;
  const paid = payCard(ctx);
  const remaining = profile.creditCardBalance - paid;
  const monthly = remaining > 0 || profile.debtPayments > 0
    ? addAutomation(ctx, (amount) => `Put ${formatMoney(amount)} more a month toward debt`, 'Credit card', Math.min(money.leftOver * 0.7, remaining > 0 ? remaining : profile.debtPayments), 'Every extra dollar saves you interest.', { priority: 'this_week' })
    : 0;
  const months = monthly > 0 && remaining > 0 ? Math.ceil(remaining / monthly) : 0;

  return {
    title: 'What clearing debt frees up',
    insights: [
      { text: `You owe ${formatMoney(profile.creditCardBalance)} on your card and pay ${formatMoney(profile.debtPayments)} a month toward debts.`, type: 'negative' },
      { text: remaining > 0 ? `${formatMoney(remaining)} stays on the card after today's payment.` : 'You can clear the card today and still keep a month of spending in the bank.', type: remaining > 0 ? 'neutral' : 'positive' },
    ],
    impact: {
      income_change: card('$0', 'No change to your income'),
      expense_change: card(monthly > 0 ? perMonth(monthly) : '$0', 'Extra going to debt'),
      net_worth_change: card('$0', 'Your debt falls as your cash falls'),
      timeline: card(months > 0 ? monthCount(months) : remaining > 0 ? 'Not yet' : 'Today', 'Until your card is clear'),
    },
    cashflow: [
      { phase: 'Today', amount: money.leftOver },
      { phase: 'Paying it off', amount: money.leftOver - monthly },
      { phase: 'Debt free', amount: money.leftOver },
    ],
  };
}

function bufferScenario(ctx: PlanContext): Scenario {
  const { money } = ctx;
  const target = money.monthlySpend * 3;
  const gap = Math.max(0, target - money.cash);

  payCard(ctx);
  const monthly = gap > 0
    ? addAutomation(ctx, (amount) => `Save ${formatMoney(amount)} a month for emergencies`, 'Emergency Fund', money.leftOver * 0.7, 'Three months of spending covers most surprises.', { target: gap, priority: 'do_now' })
    : 0;
  const months = monthly > 0 ? Math.ceil(gap / monthly) : 0;

  return {
    title: 'What a safety net looks like',
    insights: [
      { text: `Three months of spending is ${formatMoney(target)}.`, type: 'neutral' },
      { text: gap > 0 ? `You're ${formatMoney(gap)} short of that.` : 'You already have that. Now keep it there.', type: gap > 0 ? 'negative' : 'positive' },
    ],
    impact: {
      income_change: card('$0', 'No change to your income'),
      expense_change: card(monthly > 0 ? perMonth(monthly) : '$0', 'Going to your emergency fund'),
      net_worth_change: card('$0', 'Your money moves, none is spent'),
      timeline: card(gap === 0 ? 'Done' : months > 0 ? monthCount(months) : 'Not yet', 'Until three months are covered'),
    },
    cashflow: [
      { phase: 'Today', amount: money.leftOver },
      { phase: 'While saving', amount: money.leftOver - monthly },
      { phase: 'Fund is full', amount: money.leftOver },
    ],
  };
}

function goalScenario(ctx: PlanContext): Scenario {
  const { money, event } = ctx;
  const name = GOAL_FUNDS.find(([pattern]) => pattern.test(event))?.[1] ?? 'Goal Fund';
  const target = parseTarget(event) ?? Math.max(5000, roundDown(money.monthlySpend * 3, 500));
  const stated = parseTarget(event) !== null;

  payCard(ctx);
  const funded = addFund(ctx, name, target, 'Keeping it separate stops it from getting spent by accident.');
  const gap = Math.max(0, target - funded);
  const monthly = gap > 0
    ? addAutomation(ctx, (amount) => `Save ${formatMoney(amount)} a month for your ${name}`, name, money.leftOver * 0.6, 'A fixed amount each month gets you there without thinking about it.', { target: gap })
    : 0;
  const months = monthly > 0 ? Math.ceil(gap / monthly) : 0;

  return {
    title: `Getting to ${formatMoney(target)}`,
    insights: [
      { text: stated ? `Your target is ${formatMoney(target)}.` : `You didn't give an amount, so I used ${formatMoney(target)}. Tell me a number to change it.`, type: 'neutral' },
      { text: gap > 0 ? `${formatMoney(funded)} can move today, leaving ${formatMoney(gap)} to save.` : 'You can set all of it aside today.', type: gap > 0 ? 'neutral' : 'positive' },
    ],
    impact: {
      income_change: card('$0', 'No change to your income'),
      expense_change: card(monthly > 0 ? perMonth(monthly) : '$0', `Going to your ${name}`),
      net_worth_change: card(formatMoney(target), 'Set aside for this goal'),
      timeline: card(gap === 0 ? 'Today' : months > 0 ? monthCount(months) : 'Not yet', 'Until you reach it'),
    },
    cashflow: [
      { phase: 'Today', amount: money.leftOver },
      { phase: 'While saving', amount: money.leftOver - monthly },
      { phase: 'Goal reached', amount: money.leftOver },
    ],
  };
}

function generalScenario(ctx: PlanContext): Scenario {
  const { profile, money, rules } = ctx;
  payCard(ctx);

  const target = money.monthlySpend * 3;
  const gap = Math.max(0, target - money.cash);
  const buffer = gap > 0
    ? addAutomation(ctx, (amount) => `Save ${formatMoney(amount)} a month for emergencies`, 'Emergency Fund', money.leftOver * 0.5, 'Three months of spending comes before investing.', { target: gap, priority: 'this_week' })
    : 0;

  let shelter = 0;
  if (profile.tfsaRoom > 0) {
    shelter = addAutomation(ctx, (amount) => `Invest ${formatMoney(amount)} a month in your TFSA`, 'TFSA', Math.min(profile.tfsaRoom / 12, money.leftOver * 0.5), `You have ${formatMoney(profile.tfsaRoom)} of room. Growth in a TFSA is never taxed.`);
  }
  if (profile.rrspRoom > 0 && profile.annualIncome >= 60_000) {
    shelter += addAutomation(ctx, (amount) => `Invest ${formatMoney(amount)} a month in your RRSP`, 'RRSP', Math.min(profile.rrspRoom / 12, Math.min(ctx.monthlyFree, rules.rrspMaxAnnual / 12)), 'At your income, this can lower your tax bill.', { priority: 'next_quarter' });
  }
  const committed = buffer + shelter;

  return {
    title: 'Where your next dollar should go',
    insights: [
      { text: 'Pay off expensive debt first, then build a safety net, then invest.', type: 'neutral' },
      { text: `${formatMoney(committed)} a month of your spare money now has a job.`, type: committed > 0 ? 'positive' : 'neutral' },
    ],
    impact: {
      income_change: card('$0', 'No change to your income'),
      expense_change: card(committed > 0 ? perMonth(committed) : '$0', 'Going to savings and investing'),
      net_worth_change: card(formatSigned(committed * 12), 'Saved over the next year', committed > 0 ? 'positive' : 'neutral'),
      timeline: card('12 months', 'How long this plan covers'),
    },
    cashflow: [
      { phase: 'Today', amount: money.leftOver },
      { phase: 'With plan', amount: money.leftOver - committed },
    ],
  };
}

const SCENARIOS: Record<PlanKind, (ctx: PlanContext) => Scenario> = {
  baby: babyScenario,
  home: homeScenario,
  job: jobScenario,
  break: breakScenario,
  debt: debtScenario,
  buffer: bufferScenario,
  goal: goalScenario,
  general: generalScenario,
};

function startingPoint(money: MoneyPicture): ThinkingStep {
  return {
    title: 'Where you stand today',
    insights: [
      {
        text: `${formatMoney(money.cash)} in the bank covers ${money.runwayMonths.toFixed(1)} months of spending.`,
        type: money.runwayMonths >= 3 ? 'positive' : 'negative',
      },
      money.leftOver >= 0
        ? { text: `You have about ${formatMoney(money.leftOver)} left each month after tax and bills.`, type: 'positive' }
        : { text: `You're spending about ${formatMoney(-money.leftOver)} more than you bring home each month.`, type: 'negative' },
    ],
  };
}

function baseRisks(ctx: PlanContext): RiskWarning[] {
  const { money, profile } = ctx;
  const risks: RiskWarning[] = [];
  if (money.leftOver < 0) {
    risks.push({ text: `You're about ${formatMoney(-money.leftOver)} a month short before anything changes. Fix that first.`, severity: 'high' });
  }
  if (money.monthlySpend > 0 && money.runwayMonths < 1) {
    risks.push({ text: 'Your cash covers less than a month of spending.', severity: 'high' });
  } else if (money.monthlySpend > 0 && money.runwayMonths < 3) {
    risks.push({ text: `Your cash covers ${money.runwayMonths.toFixed(1)} months of spending. Aim for at least three.`, severity: 'medium' });
  }
  const unpaid = profile.creditCardBalance - ctx.actions
    .filter((action) => action.type === 'pay_off')
    .reduce((sum, action) => sum + (action.amount ?? 0), 0);
  if (unpaid > 0) {
    risks.push({ text: `${formatMoney(unpaid)} stays on your credit card, and the interest adds up fast.`, severity: 'medium' });
  }
  return risks;
}

/** Projected balances are what "Apply" would really do, so the two can't disagree. */
function buildAccountImpacts(profile: FinancialProfile, funds: CustomFund[], actions: QuickAction[]): AccountImpact[] {
  const applied = applyConfirmedActions(profile, funds, actions.map((_, index) => index), actions);
  const rows: [string, number, number, boolean?][] = [
    ['Chequing', profile.chequingBalance, applied.profile.chequingBalance],
    ['Savings', profile.savingsBalance, applied.profile.savingsBalance],
    ['TFSA', profile.tfsaBalance, applied.profile.tfsaBalance],
    ['RRSP', profile.rrspBalance, applied.profile.rrspBalance],
    ['FHSA', profile.fhsaBalance, applied.profile.fhsaBalance],
    ['Non-Registered', profile.nonRegBalance, applied.profile.nonRegBalance],
    ['Credit card', profile.creditCardBalance, applied.profile.creditCardBalance, true],
    ...applied.customFunds.map((fund): [string, number, number] => [
      fund.name,
      funds.find((existing) => existing.name === fund.name)?.balance ?? 0,
      fund.balance,
    ]),
  ];

  return rows
    .filter(([, before, after]) => before !== after)
    .map(([account_name, current_balance, projected_balance, isDebt]) => {
      const grew = projected_balance > current_balance;
      return {
        account_name,
        current_balance,
        projected_balance,
        impact_text: `${formatSigned(projected_balance - current_balance)} from today's steps`,
        status: isDebt || grew ? 'positive' : 'neutral',
      };
    });
}

export function buildLocalPlan(
  profile: FinancialProfile,
  customFunds: CustomFund[],
  event: string,
): PathfinderResult {
  const ctx = createContext(profile, customFunds, event);
  const scenario = SCENARIOS[detectPlanKind(event)](ctx);

  if (ctx.actions.length === 0) {
    addNote(ctx, 'adjust', 'Find your first $50 a month', 'Even a small automatic transfer builds the habit this plan depends on.', 'this_week');
  }

  const rank: QuickAction['priority'][] = ['do_now', 'this_week', 'this_month', 'next_quarter'];
  const actions = [...ctx.actions].sort((a, b) => rank.indexOf(a.priority) - rank.indexOf(b.priority));

  return {
    source: 'local',
    thinking_steps: [
      startingPoint(ctx.money),
      { title: scenario.title, insights: scenario.insights },
    ],
    impact_summary: scenario.impact,
    quick_actions: actions,
    advisor_flags: scenario.flags ?? [],
    risk_warnings: [...baseRisks(ctx), ...(scenario.risks ?? [])],
    account_impacts: buildAccountImpacts(profile, customFunds, actions),
    monthly_cashflow: scenario.cashflow.map((point) => ({ ...point, amount: Math.round(point.amount) })),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Plays the built-in planner through the same stream events the AI pipeline uses. */
export async function runLocalStream(
  profile: FinancialProfile,
  customFunds: CustomFund[],
  event: string,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const result = buildLocalPlan(profile, customFunds, event);
  const kind = detectPlanKind(event);
  const money = getMoneyPicture(profile, customFunds);
  const metrics = computeDerivedMetrics(profile, customFunds);
  const steps = [
    { id: 'router', label: 'Reading your situation', detail: `Planning for ${KIND_LABELS[kind]}` },
    { id: 'analyze', label: 'Running your numbers', detail: `${metrics.emergencyFundMonths.toFixed(1)} months of cash` },
    { id: 'generate', label: 'Drafting your plan', detail: `${result.quick_actions.length} steps` },
    { id: 'guardrails', label: 'Checking every dollar', detail: 'Each step fits your real balances' },
  ];

  for (const step of steps) {
    onEvent({ type: 'step', id: step.id, status: 'active', label: step.label });
    await wait(520);
    onEvent({ type: 'step', id: step.id, status: 'complete', label: step.label, detail: step.detail });
    if (step.id === 'analyze') {
      onEvent({ type: 'thinking_steps', steps: result.thinking_steps });
    }
  }

  const debugLog: DebugLog = {
    entries: [{ step: 'Router', detail: `Used the built-in plan for ${KIND_LABELS[kind]}. No AI or live rates.` }],
    actionsBeforeGuardrails: result.quick_actions.length,
    actionsAfterGuardrails: result.quick_actions.length,
    removedActions: [],
  };
  onEvent({ type: 'complete', result, searchMetadata: null, debugLog });
}

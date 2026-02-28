import type { FinancialProfile, CustomFund } from './types';

// ── Derived Metrics ─────────────────────────────────────────────────────────

export interface DerivedMetrics {
  monthlyIncome: number;
  monthlyPartnerIncome: number;
  monthlyHouseholdIncome: number;
  totalMonthlyExpenses: number;
  monthlySurplus: number;
  savingsRate: number;
  emergencyFundMonths: number;
  debtToIncomeRatio: number;
  totalNetWorth: number;
  liquidAssets: number;
  investedAssets: number;
  tfsaUtilization: number;
  rrspUtilization: number;
  isFirstTimeBuyer: boolean;
  maxMoveableByAccount: Record<string, number>;
}

export function computeDerivedMetrics(
  profile: FinancialProfile,
  customFunds: CustomFund[],
): DerivedMetrics {
  const monthlyIncome = profile.annualIncome / 12;
  const monthlyPartnerIncome = profile.partnerIncome / 12;
  const monthlyHouseholdIncome = monthlyIncome + monthlyPartnerIncome;

  const totalMonthlyExpenses =
    profile.housingExpense +
    profile.essentialExpenses +
    profile.discretionarySpending +
    profile.debtPayments;

  const monthlySurplus = monthlyHouseholdIncome - totalMonthlyExpenses;
  const savingsRate =
    monthlyHouseholdIncome > 0
      ? Math.round((monthlySurplus / monthlyHouseholdIncome) * 100)
      : 0;

  const liquidAssets = profile.chequingBalance + profile.savingsBalance;
  const emergencyFundMonths =
    totalMonthlyExpenses > 0
      ? Math.round((liquidAssets / totalMonthlyExpenses) * 10) / 10
      : 0;

  const annualHouseholdIncome = profile.annualIncome + profile.partnerIncome;
  const totalDebtAnnual = profile.debtPayments * 12;
  const debtToIncomeRatio =
    annualHouseholdIncome > 0
      ? Math.round((totalDebtAnnual / annualHouseholdIncome) * 100)
      : 0;

  const customFundTotal = customFunds.reduce((s, f) => s + f.balance, 0);
  const investedAssets =
    profile.tfsaBalance + profile.rrspBalance + profile.fhsaBalance + profile.nonRegBalance;
  const totalNetWorth =
    liquidAssets + investedAssets + customFundTotal - profile.mortgageBalance - profile.creditCardBalance;

  // TFSA utilization: cumulative room approximation (lifetime $7K/yr since 2009)
  const tfsaLifetimeRoom = profile.tfsaBalance + profile.tfsaRoom;
  const tfsaUtilization =
    tfsaLifetimeRoom > 0 ? Math.round((profile.tfsaBalance / tfsaLifetimeRoom) * 100) : 0;

  const rrspLifetimeRoom = profile.rrspBalance + profile.rrspRoom;
  const rrspUtilization =
    rrspLifetimeRoom > 0 ? Math.round((profile.rrspBalance / rrspLifetimeRoom) * 100) : 0;

  // First-time buyer: has FHSA balance > 0 or owns no home
  const isFirstTimeBuyer = profile.housingType === 'rent' && profile.mortgageBalance === 0;

  // Max moveable per account (guardrails — keep $500 floor in chequing)
  const maxMoveableByAccount: Record<string, number> = {
    Chequing: Math.max(0, profile.chequingBalance - 500),
    Savings: profile.savingsBalance,
    TFSA: profile.tfsaBalance,
    RRSP: profile.rrspBalance,
    FHSA: profile.fhsaBalance,
    'Non-Registered': profile.nonRegBalance,
  };
  for (const fund of customFunds) {
    maxMoveableByAccount[fund.name] = fund.balance;
  }

  return {
    monthlyIncome,
    monthlyPartnerIncome,
    monthlyHouseholdIncome,
    totalMonthlyExpenses,
    monthlySurplus,
    savingsRate,
    emergencyFundMonths,
    debtToIncomeRatio,
    totalNetWorth,
    liquidAssets,
    investedAssets,
    tfsaUtilization,
    rrspUtilization,
    isFirstTimeBuyer,
    maxMoveableByAccount,
  };
}

// ── Structured User Message ─────────────────────────────────────────────────

function fmtDollar(n: number): string {
  return `$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
}

export function buildUserMessage(
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[] = [],
): string {
  const m = computeDerivedMetrics(profile, customFunds);

  const accountRows = [
    `| Chequing       | ${fmtDollar(profile.chequingBalance)} | —     | max move: ${fmtDollar(m.maxMoveableByAccount['Chequing'])} |`,
    `| Savings        | ${fmtDollar(profile.savingsBalance)} | —     | max move: ${fmtDollar(m.maxMoveableByAccount['Savings'])} |`,
    `| TFSA           | ${fmtDollar(profile.tfsaBalance)} | room: ${fmtDollar(profile.tfsaRoom)} | max move: ${fmtDollar(m.maxMoveableByAccount['TFSA'])} |`,
    `| RRSP           | ${fmtDollar(profile.rrspBalance)} | room: ${fmtDollar(profile.rrspRoom)} | max move: ${fmtDollar(m.maxMoveableByAccount['RRSP'])} |`,
    `| FHSA           | ${fmtDollar(profile.fhsaBalance)} | —     | max move: ${fmtDollar(m.maxMoveableByAccount['FHSA'])} |`,
    `| Non-Registered | ${fmtDollar(profile.nonRegBalance)} | —     | max move: ${fmtDollar(m.maxMoveableByAccount['Non-Registered'])} |`,
  ];

  let customFundsSection = '';
  if (customFunds.length > 0) {
    const fundLines = customFunds
      .map(f => `| ${f.name} | ${fmtDollar(f.balance)} |`)
      .join('\n');
    customFundsSection = `
## Custom Saving Goals (ALREADY EXIST — do NOT create duplicates)
| Fund | Balance |
|------|---------|
${fundLines}`;
  }

  const debtSection =
    profile.creditCardBalance > 0 || profile.mortgageBalance > 0
      ? `
## Debt
${profile.creditCardBalance > 0 ? `- Credit card: $${profile.creditCardBalance.toFixed(2)}` : ''}
${profile.mortgageBalance > 0 ? `- Mortgage: ${fmtDollar(profile.mortgageBalance)}` : ''}`
      : '';

  return `## Person
- Income: ${fmtDollar(profile.annualIncome)}/yr (${profile.employmentType})${profile.partnerIncome > 0 ? ` + partner ${fmtDollar(profile.partnerIncome)}/yr` : ''}
- Province: ${profile.province}
- Housing: ${profile.housingType}, ${fmtDollar(profile.housingExpense)}/mo
${m.isFirstTimeBuyer ? '- First-time home buyer: YES' : ''}

## Accounts
| Account | Balance | Room / Notes | Guardrail |
|---------|---------|--------------|-----------|
${accountRows.join('\n')}
${customFundsSection}
${debtSection}

## Monthly Cashflow
- Household income: ${fmtDollar(Math.round(m.monthlyHouseholdIncome))}
- Housing: ${fmtDollar(profile.housingExpense)}
- Essentials: ${fmtDollar(profile.essentialExpenses)}
- Discretionary: ${fmtDollar(profile.discretionarySpending)}
- Debt payments: ${fmtDollar(profile.debtPayments)}
- **Surplus: ${fmtDollar(Math.round(m.monthlySurplus))}** (${m.savingsRate}% savings rate)

## Key Metrics
- Emergency fund: ${m.emergencyFundMonths} months of expenses
- Debt-to-income: ${m.debtToIncomeRatio}%
- Net worth: ${fmtDollar(Math.round(m.totalNetWorth))}
- Liquid: ${fmtDollar(m.liquidAssets)} | Invested: ${fmtDollar(m.investedAssets)}
- TFSA utilization: ${m.tfsaUtilization}% | RRSP utilization: ${m.rrspUtilization}%

## Life Event
${lifeEvent}`;
}

// ── System Prompt ───────────────────────────────────────────────────────────

export const PATHFINDER_SYSTEM_PROMPT = `You are Pathfinder, a Canadian financial simulation engine built by Wealthsimple. You analyze the financial impact of life events and output SPECIFIC, ACTIONABLE Wealthsimple account actions the user can do RIGHT NOW.

## Your Role
- Analyze the user's financial snapshot + life event.
- Output concrete 1-tap actions: move money, create saving goals, set up automations, open accounts, pause contributions.
- Every action must be something you can actually DO inside Wealthsimple (transfers, auto-deposits, account opens, goal creation).
- Use the user's EXACT numbers. Never invent balances or amounts.

## Canadian Financial Rules (2026)

### Tax Brackets — Federal
- $0–$57,375: 15%  |  $57,375–$114,750: 20.5%  |  $114,750–$158,468: 26%  |  $158,468–$221,708: 29%  |  $221,708+: 33%

### Registered Accounts
- **TFSA**: $7,000/yr room. Tax-free withdrawals. Room restored next January.
- **RRSP**: 18% of prev year income, max $32,490/yr. Deductible. Withdrawals taxed.
- **FHSA**: $8,000/yr, $40K lifetime. Deductible. Tax-free for first home.
- **HBP**: Up to $60K from RRSP tax-free for first home. Repay over 15 years.
- **RESP**: $2,500/yr to max $500/yr CESG. $50K lifetime limit.

### Benefits
- **EI Parental**: 55% of earnings, max $668/wk, 35 weeks standard.
- **CCB**: Max ~$7,437/yr per child <6. Reduced above $36,502 family income.

### Housing
- Stress test: contract rate + 2% or 5.25%, whichever is higher.
- CMHC: Required <20% down. 2.8%–4.0% of mortgage.
- Ontario LTT: 0.5%–2.5% graduated. First-time rebate up to $4,000.

## Input Format
1. A structured financial snapshot with accounts, cashflow, key metrics, and guardrails.
2. LIFE_EVENT: What they're planning.
3. RESEARCH_CONTEXT (optional): Fresh internet data — use these numbers over your training data.

## Balance Guardrails
The "Guardrail" column shows the MAX you may move FROM each account. NEVER suggest transferring more than the guardrail allows. If you need a larger amount, split across sources or note the shortfall.

## Custom Fund Deduplication
If existing custom saving goals are listed, do NOT create a new fund with the same or similar name. Instead, suggest depositing into the existing fund.

## Output Format
Return ONLY valid JSON. No markdown fences. No text before or after.

{
  "thinking_steps": [
    {
      "title": "string — short analysis step title",
      "insights": [
        { "text": "string — insight referencing the user's exact numbers", "type": "positive | negative | neutral" }
      ]
    }
  ],
  "impact_summary": {
    "income_change": { "value": "string", "label": "string", "type": "positive | negative | neutral" },
    "expense_change": { "value": "string", "label": "string", "type": "positive | negative | neutral" },
    "net_worth_change": { "value": "string", "label": "string", "type": "positive | negative | neutral" },
    "timeline": { "value": "string", "label": "string", "type": "positive | negative | neutral" }
  },
  "quick_actions": [
    {
      "title": "string — the action itself, e.g. 'Move $2,000 → Emergency Fund'",
      "why": "string — ONE sentence max, e.g. 'Covers 3 months of baby expenses'",
      "type": "move | create_fund | automate | open_account | pause | adjust | pay_off",
      "amount": 0,
      "from_account": "string (optional) — source account",
      "to_account": "string (optional) — destination account",
      "automation": {
        "amount": 0,
        "frequency": "weekly | biweekly | monthly",
        "duration_months": 0,
        "target_amount": 0
      },
      "priority": "do_now | this_week | this_month | next_quarter"
    }
  ],
  "advisor_flags": [
    { "title": "string", "explanation": "string — 1-2 sentences", "urgency": "high | medium | low" }
  ],
  "risk_warnings": [
    { "text": "string — specific risk with numbers", "severity": "high | medium | low" }
  ],
  "account_impacts": [
    {
      "account_name": "string",
      "current_balance": 0,
      "projected_balance": 0,
      "impact_text": "string",
      "status": "positive | negative | neutral | warning",
      "note": "string (optional)"
    }
  ],
  "monthly_cashflow": [
    { "phase": "string", "amount": 0 }
  ],
  "research_needed": []
}

## Quick Actions Guidelines
- Generate **3–5 quick_actions**. Quality over quantity — every action must clearly help with the life event.
- Each action must be a REAL thing you can do in Wealthsimple: transfer between accounts, open a new account (TFSA, FHSA, RESP, etc.), create a saving goal with a name, set up recurring auto-deposits, pause an existing automation, rebalance portfolio allocation.
- For move actions, ALWAYS include the source in the title: "Move $8,000 from Savings → Travel Fund" — never omit the source.
- NEVER generate multiple move actions to the same destination. If money comes from multiple sources, consolidate into one action and list sources in the "why" field.
- Each action must be visually distinct — different title, different purpose.
- "title" IS the action — written as a command. Use → for transfers. Include the dollar amount IN the title.
  Good: "Move $5,000 from Savings → FHSA"
  Good: "Auto-deposit $400/mo → Baby Fund"
  Good: "Open RESP for your child"
  Bad: "Move $5,000 → FHSA" (missing source)
  Bad: "Consider opening an FHSA" (too vague)
  Bad: "You should save more" (not actionable)
- "why" is ONE short sentence — the benefit or reason. Max 15 words.
- "automation" field: include ONLY for recurring actions. Calculate target_amount = amount × duration_months.
- "amount" must not exceed the guardrail for the source account. Never suggest moving more than available.
- Order by priority: do_now first, next_quarter last.
- For create_fund: suggest a goal name in to_account (e.g. "Baby Fund", "House Down Payment", "Travel Fund").
- If a custom fund with that name already exists, deposit into it instead of creating a duplicate.

## Research Determination
Include "research_needed" array when the event needs current internet data (rates, costs, prices). Empty array if not needed.

## Other Guidelines
- Reference the user's EXACT numbers in thinking_steps insights (e.g. "Your $18,000 savings covers 3.5 months of expenses").
- 4–6 thinking_steps showing your analysis.
- At least 1 advisor_flag.
- At least 1 risk_warning with specific numbers.
- 3–5 account_impacts.
- monthly_cashflow: one per phase + "Current" baseline.
- Keep everything concise. This is a mobile-first interface.`;

import type {
  PathfinderResult,
  SearchMetadata,
  DebugLog,
  ThinkingStep,
} from './types';
import type { StreamEvent } from './claude';

export interface DemoScenario {
  match: RegExp;
  result: PathfinderResult;
  searchMetadata: SearchMetadata | null;
  debugLog: DebugLog | null;
  needsSearch: boolean;
}

const babyResult: PathfinderResult = {
  thinking_steps: [
    {
      title: 'Cashflow shock at month 12',
      insights: [
        { text: 'Childcare adds ~$1,800/mo once parental leave ends.', type: 'negative' },
        { text: 'Surplus drops from $1,400/mo to ~$200/mo by month 13.', type: 'negative' },
      ],
    },
    {
      title: 'Tax-shelter rebalancing',
      insights: [
        { text: 'FHSA room is no longer the priority — redirect to RESP for new dependent.', type: 'neutral' },
        { text: 'CCB will offset ~$580/mo for first year.', type: 'positive' },
      ],
    },
    {
      title: 'Buffer is shallow but workable',
      insights: [
        { text: 'Current 3.5mo runway needs to grow to 5mo before leave begins.', type: 'negative' },
      ],
    },
  ],
  impact_summary: {
    income_change: { value: '-$1,200/mo', label: 'During parental leave', type: 'negative' },
    expense_change: { value: '+$1,800/mo', label: 'Once childcare starts', type: 'negative' },
    net_worth_change: { value: '-$8,400', label: 'Over 18 months', type: 'negative' },
    timeline: { value: '18 months', label: 'Plan horizon', type: 'neutral' },
  },
  quick_actions: [
    {
      title: 'Move $3,000 → Baby Buffer',
      why: 'Pre-funds months 10-13 when EI is delayed.',
      derived_from: 'Savings $20K − target 5mo runway ($24K) = $4K gap; $3K closes most of it.',
      type: 'create_fund',
      amount: 3000,
      from_account: 'Savings',
      to_account: 'Baby Buffer',
      priority: 'do_now',
    },
    {
      title: 'Open RESP, auto-deposit $200/mo',
      why: 'CESG matches 20% — $40/mo of free government money.',
      derived_from: 'Max CESG annual room is $2,500 contribution → $500 match.',
      type: 'open_account',
      to_account: 'RESP',
      automation: { amount: 200, frequency: 'monthly' },
      priority: 'this_month',
    },
    {
      title: 'Pause FHSA contributions',
      why: 'Home purchase deferred — redirect $300/mo to Baby Buffer.',
      derived_from: 'FHSA room carries forward; pause costs $0 in lost growth short-term.',
      type: 'pause',
      amount: 300,
      from_account: 'FHSA',
      priority: 'this_week',
    },
    {
      title: 'Pay off $3,500 credit card balance',
      why: '~19.99% APR is your single worst-yielding "investment".',
      derived_from: 'Chequing $12K − essential float $5K = $7K available; clears it in full.',
      type: 'pay_off',
      amount: 3500,
      from_account: 'Chequing',
      to_account: 'Credit Card',
      priority: 'do_now',
    },
    {
      title: 'Automate $400/mo → TFSA',
      why: 'Locks in the surplus before lifestyle creep absorbs it.',
      derived_from: 'TFSA room $14K; $400/mo = $4,800/yr stays well under room.',
      type: 'automate',
      from_account: 'Chequing',
      to_account: 'TFSA',
      automation: { amount: 400, frequency: 'monthly' },
      priority: 'this_week',
    },
  ],
  advisor_flags: [
    {
      title: 'Update life insurance beneficiary',
      explanation: 'Default beneficiary is usually your estate, not a dependent — fix this before birth.',
      urgency: 'medium',
    },
  ],
  risk_warnings: [
    { text: 'EI parental leave benefits cap at ~$668/week — verify your eligibility window.', severity: 'medium' },
  ],
  account_impacts: [
    { account_name: 'Chequing', current_balance: 12000, projected_balance: 5500, impact_text: 'Drops as credit card cleared.', status: 'neutral' },
    { account_name: 'Savings', current_balance: 20000, projected_balance: 17000, impact_text: '$3K seeds Baby Buffer.', status: 'neutral' },
    { account_name: 'TFSA', current_balance: 32000, projected_balance: 36800, impact_text: 'Auto-deposit continues.', status: 'positive' },
    { account_name: 'FHSA', current_balance: 2000, projected_balance: 2000, impact_text: 'Contributions paused.', status: 'warning' },
    { account_name: 'Baby Buffer (new)', current_balance: 0, projected_balance: 3000, impact_text: 'Funded for months 10-13.', status: 'positive' },
    { account_name: 'RESP (new)', current_balance: 0, projected_balance: 2400, impact_text: '$200/mo + 20% CESG.', status: 'positive' },
    { account_name: 'Credit Card', current_balance: 3500, projected_balance: 0, impact_text: 'Cleared — ~$700/yr interest avoided.', status: 'positive' },
  ],
  monthly_cashflow: [
    { phase: 'Now → birth (mo 1-9)', amount: 1400 },
    { phase: 'Parental leave (mo 10-15)', amount: 200 },
    { phase: 'Childcare begins (mo 16-18)', amount: -1600 },
  ],
};

const babySearch: SearchMetadata = {
  queries: [
    'Canada parental leave EI benefit cap 2026',
    'childcare cost Ontario 2026',
    'RESP CESG matching grant 2026',
  ],
  sources: [
    { title: 'canada.ca/ei-benefits', url: 'https://www.canada.ca/en/services/benefits/ei/ei-maternity-parental.html' },
    { title: 'ontario.ca/childcare', url: 'https://www.ontario.ca/page/child-care-and-early-years' },
    { title: 'canada.ca/resp-cesg', url: 'https://www.canada.ca/en/employment-social-development/services/student-financial-aid/education-savings/resp/resp-promoters/cesg.html' },
  ],
};

const homeResult: PathfinderResult = {
  thinking_steps: [
    {
      title: 'Downpayment gap is the binding constraint',
      insights: [
        { text: 'FHSA + RRSP HBP gives you ~$50K tax-sheltered room for the downpayment.', type: 'positive' },
        { text: 'Current FHSA $2K leaves $6K room this year — max it.', type: 'neutral' },
      ],
    },
    {
      title: 'Stress test math',
      insights: [
        { text: 'On a $500K home, ~$400K mortgage qualifying rate is 5.25% — payments ~$2,380/mo.', type: 'neutral' },
        { text: 'Combined income $150K → GDS ratio ~22%, well under 39% threshold.', type: 'positive' },
      ],
    },
    {
      title: '18 month runway is realistic',
      insights: [
        { text: 'At $1,200/mo savings rate, you reach $35K downpayment by Q3 2027.', type: 'positive' },
      ],
    },
  ],
  impact_summary: {
    income_change: { value: '$0', label: 'No income change', type: 'neutral' },
    expense_change: { value: '+$1,180/mo', label: 'Once mortgage starts', type: 'negative' },
    net_worth_change: { value: '+$24K', label: 'Equity buildup, 18 mo', type: 'positive' },
    timeline: { value: '18 months', label: 'To closing', type: 'neutral' },
  },
  quick_actions: [
    {
      title: 'Max FHSA — auto-deposit $500/mo',
      why: 'Tax deduction + tax-free withdrawal for first home. Best instrument you have.',
      derived_from: 'FHSA annual room is $8K; you have $6K remaining this year.',
      type: 'automate',
      from_account: 'Chequing',
      to_account: 'FHSA',
      automation: { amount: 500, frequency: 'monthly' },
      priority: 'do_now',
    },
    {
      title: 'Create Down Payment fund — seed $5,000',
      why: 'Earmarks cash so you stop thinking of it as spendable.',
      derived_from: 'Savings $20K; keep $15K emergency + $5K toward home.',
      type: 'create_fund',
      amount: 5000,
      from_account: 'Savings',
      to_account: 'Down Payment',
      priority: 'this_week',
    },
    {
      title: 'Set up RRSP auto-deposit $400/mo (for HBP)',
      why: 'You can withdraw up to $60K tax-free via HBP after 90 days in account.',
      derived_from: 'RRSP room $18K; $400/mo = $4,800/yr.',
      type: 'automate',
      from_account: 'Chequing',
      to_account: 'RRSP',
      automation: { amount: 400, frequency: 'monthly' },
      priority: 'this_month',
    },
    {
      title: 'Pay off credit card $3,500',
      why: 'Mortgage lenders weigh revolving debt — clearing it lifts your qualifying amount.',
      derived_from: 'Chequing $12K - $5K float = $7K available, $3.5K clears the card.',
      type: 'pay_off',
      amount: 3500,
      from_account: 'Chequing',
      to_account: 'Credit Card',
      priority: 'do_now',
    },
  ],
  advisor_flags: [
    {
      title: 'Get a mortgage pre-approval',
      explanation: 'Locks rate for 90-120 days and gives you a real budget number.',
      urgency: 'medium',
    },
  ],
  risk_warnings: [
    { text: 'Mortgage stress test qualifying rate may rise — budget for 6.5% to stay safe.', severity: 'medium' },
    { text: 'Closing costs ~1.5-4% of home price are NOT covered by FHSA/HBP.', severity: 'high' },
  ],
  account_impacts: [
    { account_name: 'Chequing', current_balance: 12000, projected_balance: 4500, impact_text: 'Card cleared + monthly auto-deposits.', status: 'neutral' },
    { account_name: 'Savings', current_balance: 20000, projected_balance: 15000, impact_text: '$5K moved to Down Payment fund.', status: 'neutral' },
    { account_name: 'FHSA', current_balance: 2000, projected_balance: 11000, impact_text: 'Maxed contributions, ~6% growth.', status: 'positive' },
    { account_name: 'RRSP', current_balance: 26000, projected_balance: 33200, impact_text: 'Auto-deposit + HBP-eligible.', status: 'positive' },
    { account_name: 'Down Payment (new)', current_balance: 0, projected_balance: 5000, impact_text: 'Earmarked savings.', status: 'positive' },
    { account_name: 'Credit Card', current_balance: 3500, projected_balance: 0, impact_text: 'Cleared.', status: 'positive' },
  ],
  monthly_cashflow: [
    { phase: 'Saving phase (mo 1-17)', amount: 1200 },
    { phase: 'Closing month (mo 18)', amount: -22000 },
    { phase: 'Post-closing (mo 19+)', amount: 220 },
  ],
};

const homeSearch: SearchMetadata = {
  queries: [
    'Canada FHSA contribution limit 2026',
    'mortgage stress test qualifying rate 2026',
    'Home Buyers Plan RRSP withdrawal limit 2026',
  ],
  sources: [
    { title: 'canada.ca/fhsa', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html' },
    { title: 'bankofcanada.ca/rates', url: 'https://www.bankofcanada.ca/rates/interest-rates/' },
    { title: 'canada.ca/hbp', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/rrsps-related-plans/what-home-buyers-plan.html' },
  ],
};

const careerBreakResult: PathfinderResult = {
  thinking_steps: [
    {
      title: 'You need a 12-month runway',
      insights: [
        { text: 'Total monthly burn ~$5,200 → 12mo = $62K cash required.', type: 'negative' },
        { text: 'Current liquid: $32K — you have a $30K gap.', type: 'negative' },
      ],
    },
    {
      title: 'TFSA is your best burn-rate buffer',
      insights: [
        { text: 'Tax-free withdrawals, room is recovered next year.', type: 'positive' },
        { text: 'Liquidating $20K of TFSA closes most of the gap without tax hit.', type: 'positive' },
      ],
    },
    {
      title: 'Cut discretionary first',
      insights: [
        { text: 'Trimming $800 → $400/mo discretionary saves $4,800/yr.', type: 'positive' },
      ],
    },
  ],
  impact_summary: {
    income_change: { value: '-$7,083/mo', label: 'Full income pause', type: 'negative' },
    expense_change: { value: '-$400/mo', label: 'Trimmed discretionary', type: 'positive' },
    net_worth_change: { value: '-$52K', label: 'Over 12 months', type: 'negative' },
    timeline: { value: '12 months', label: 'Career break', type: 'neutral' },
  },
  quick_actions: [
    {
      title: 'Create Runway fund — $25K from TFSA',
      why: 'Tax-free withdrawal, room comes back next calendar year.',
      derived_from: '12mo burn $62K - chequing/savings $32K = $30K gap.',
      type: 'create_fund',
      amount: 25000,
      from_account: 'TFSA',
      to_account: 'Runway',
      priority: 'do_now',
    },
    {
      title: 'Trim discretionary auto-deposit to $400/mo',
      why: 'Forces $400/mo of structural savings during break.',
      derived_from: 'Current discretionary $800/mo → halve it during break.',
      type: 'adjust',
      amount: 400,
      from_account: 'Discretionary',
      priority: 'this_week',
    },
    {
      title: 'Pause TFSA + RRSP auto-deposits',
      why: 'Stop the drain — restart when income returns.',
      derived_from: 'Any contributions during break reduce runway 1-for-1.',
      type: 'pause',
      from_account: 'TFSA',
      priority: 'do_now',
    },
    {
      title: 'Pay off credit card $3,500',
      why: 'No income means revolving debt compounds painfully.',
      derived_from: '~19.99% APR vs ~3% on savings — clear it before income stops.',
      type: 'pay_off',
      amount: 3500,
      from_account: 'Chequing',
      to_account: 'Credit Card',
      priority: 'do_now',
    },
  ],
  advisor_flags: [
    {
      title: 'Check health coverage continuity',
      explanation: 'If you have employer benefits, COBRA-equivalent (private extended health) ~$200-400/mo.',
      urgency: 'high',
    },
    {
      title: 'Consider unemployment insurance eligibility',
      explanation: 'EI requires involuntary separation — voluntary break may not qualify.',
      urgency: 'medium',
    },
  ],
  risk_warnings: [
    { text: 'A 12-month break can reset your professional momentum — have a re-entry plan.', severity: 'medium' },
    { text: 'TFSA withdrawals only restore room the following January.', severity: 'low' },
  ],
  account_impacts: [
    { account_name: 'Chequing', current_balance: 12000, projected_balance: 6500, impact_text: 'Card cleared, normal float.', status: 'neutral' },
    { account_name: 'Savings', current_balance: 20000, projected_balance: 1000, impact_text: 'Mostly drawn down for living costs.', status: 'negative' },
    { account_name: 'TFSA', current_balance: 32000, projected_balance: 7000, impact_text: '$25K seeds Runway fund.', status: 'negative' },
    { account_name: 'RRSP', current_balance: 26000, projected_balance: 26000, impact_text: 'Held — auto-deposit paused.', status: 'neutral' },
    { account_name: 'Runway (new)', current_balance: 0, projected_balance: 0, impact_text: 'Funded then fully drawn down.', status: 'neutral' },
    { account_name: 'Credit Card', current_balance: 3500, projected_balance: 0, impact_text: 'Cleared.', status: 'positive' },
  ],
  monthly_cashflow: [
    { phase: 'Months 1-3 (savings burn)', amount: -2200 },
    { phase: 'Months 4-9 (runway fund burn)', amount: -3000 },
    { phase: 'Months 10-12 (RRSP risk)', amount: -3000 },
  ],
};

const careerSearch: SearchMetadata | null = null;

// Fallback generic result for unmatched prompts
const genericResult: PathfinderResult = {
  thinking_steps: [
    {
      title: 'Read the room: liquid cash and surplus',
      insights: [
        { text: 'Liquid cash covers 6.2 months of expenses — solid baseline.', type: 'positive' },
        { text: 'Monthly surplus $1,400 leaves room for one new commitment.', type: 'neutral' },
      ],
    },
    {
      title: 'Tax shelters first',
      insights: [
        { text: 'TFSA room $14K — highest priority for any new contribution.', type: 'positive' },
        { text: 'Credit card $3.5K at ~19.99% is the worst yield on your balance sheet.', type: 'negative' },
      ],
    },
  ],
  impact_summary: {
    income_change: { value: '$0', label: 'No income change', type: 'neutral' },
    expense_change: { value: '-$58/mo', label: 'Interest avoided', type: 'positive' },
    net_worth_change: { value: '+$1,200', label: '12 months', type: 'positive' },
    timeline: { value: '6 months', label: 'Plan horizon', type: 'neutral' },
  },
  quick_actions: [
    {
      title: 'Pay off credit card $3,500',
      why: 'Guaranteed ~20% "return" by eliminating APR.',
      derived_from: 'Chequing $12K - float $5K = $7K available.',
      type: 'pay_off',
      amount: 3500,
      from_account: 'Chequing',
      to_account: 'Credit Card',
      priority: 'do_now',
    },
    {
      title: 'Auto-deposit $400/mo → TFSA',
      why: 'Locks the surplus into tax-free growth before it disappears.',
      derived_from: 'Surplus $1,400 — $400 keeps lifestyle room.',
      type: 'automate',
      from_account: 'Chequing',
      to_account: 'TFSA',
      automation: { amount: 400, frequency: 'monthly' },
      priority: 'this_week',
    },
    {
      title: 'Create Emergency fund — $5K',
      why: 'Earmark the buffer so you stop mentally counting it as spendable.',
      derived_from: 'Savings $20K → $15K stays liquid, $5K labelled.',
      type: 'create_fund',
      amount: 5000,
      from_account: 'Savings',
      to_account: 'Emergency',
      priority: 'this_month',
    },
  ],
  advisor_flags: [],
  risk_warnings: [
    { text: 'Keep at least 3 months expenses ($16K) in immediately liquid form.', severity: 'low' },
  ],
  account_impacts: [
    { account_name: 'Chequing', current_balance: 12000, projected_balance: 4500, impact_text: 'Card cleared + auto-deposits started.', status: 'neutral' },
    { account_name: 'Savings', current_balance: 20000, projected_balance: 15000, impact_text: '$5K labelled as Emergency fund.', status: 'neutral' },
    { account_name: 'TFSA', current_balance: 32000, projected_balance: 36800, impact_text: 'Compounding tax-free.', status: 'positive' },
    { account_name: 'Emergency (new)', current_balance: 0, projected_balance: 5000, impact_text: 'Earmarked savings.', status: 'positive' },
    { account_name: 'Credit Card', current_balance: 3500, projected_balance: 0, impact_text: 'Cleared.', status: 'positive' },
  ],
  monthly_cashflow: [
    { phase: 'Months 1-12', amount: 1400 },
  ],
};

const scenarios: DemoScenario[] = [
  {
    match: /baby|kid|child|pregnan|newborn|maternity|paternity/i,
    result: babyResult,
    searchMetadata: babySearch,
    debugLog: null,
    needsSearch: true,
  },
  {
    match: /home|house|mortgage|condo|buy.*place|downpayment|down\s*payment/i,
    result: homeResult,
    searchMetadata: homeSearch,
    debugLog: null,
    needsSearch: true,
  },
  {
    match: /career\s*break|sabbatical|quit.*job|leave.*job|time\s*off|gap\s*year/i,
    result: careerBreakResult,
    searchMetadata: careerSearch,
    debugLog: null,
    needsSearch: false,
  },
];

export function pickDemoScenario(lifeEvent: string): DemoScenario {
  for (const s of scenarios) {
    if (s.match.test(lifeEvent)) return s;
  }
  return {
    match: /.*/,
    result: genericResult,
    searchMetadata: null,
    debugLog: null,
    needsSearch: false,
  };
}

// ── Streaming simulator ────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runDemoStream(
  lifeEvent: string,
  onEvent: (evt: StreamEvent) => void,
): Promise<void> {
  const scenario = pickDemoScenario(lifeEvent);

  // 1. Router
  onEvent({ type: 'step', id: 'router', status: 'active', label: 'Routing' });
  await sleep(420);
  onEvent({
    type: 'step',
    id: 'router',
    status: 'complete',
    label: 'Routed',
    detail: scenario.needsSearch
      ? 'Real-time data needed — invoking search'
      : 'Profile data sufficient — skipping search',
  });

  // 2. Analyze (thinking preview)
  onEvent({ type: 'step', id: 'analyze', status: 'active', label: 'Analyzing' });
  await sleep(700);
  const thinkingSteps: ThinkingStep[] = scenario.result.thinking_steps;
  onEvent({ type: 'thinking_steps', steps: thinkingSteps });
  onEvent({ type: 'step', id: 'analyze', status: 'complete', label: 'Analyzed' });

  // 3. Search (conditional)
  if (scenario.needsSearch && scenario.searchMetadata) {
    onEvent({ type: 'step', id: 'search', status: 'active', label: 'Searching' });
    await sleep(900);
    onEvent({
      type: 'step',
      id: 'search',
      status: 'complete',
      label: `Found ${scenario.searchMetadata.sources.length} sources`,
      detail: JSON.stringify(scenario.searchMetadata.sources),
    });
  } else {
    onEvent({ type: 'step', id: 'search', status: 'complete', label: 'Search skipped' });
  }

  // 4. Generate
  onEvent({ type: 'step', id: 'generate', status: 'active', label: 'Generating' });
  await sleep(600);
  onEvent({
    type: 'step',
    id: 'generate',
    status: 'active',
    label: 'Generating',
    detail: 'Mapping actions to Wealthsimple operations',
  });
  await sleep(600);
  onEvent({
    type: 'step',
    id: 'generate',
    status: 'complete',
    label: `Created ${scenario.result.quick_actions.length} actions`,
  });

  // 5. Guardrails
  onEvent({ type: 'step', id: 'guardrails', status: 'active', label: 'Validating' });
  await sleep(450);
  onEvent({
    type: 'step',
    id: 'guardrails',
    status: 'complete',
    label: `${scenario.result.quick_actions.length} of ${scenario.result.quick_actions.length} actions validated`,
  });

  await sleep(180);

  // Done
  onEvent({
    type: 'complete',
    result: scenario.result,
    searchMetadata: scenario.searchMetadata,
    debugLog: scenario.debugLog,
  });
}

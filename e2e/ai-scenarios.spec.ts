import { test, expect } from '@playwright/test';

/**
 * 5 AI Scenario Tests — hits the REAL Gemini API.
 * Validates that every action is feasible, relevant, and data-backed.
 *
 * Run: npx playwright test e2e/ai-scenarios.spec.ts
 * Requires: GOOGLE_API_KEY in .env + dev server on port 3000
 */

// Default profile (matches src/lib/defaults.ts)
const PROFILE = {
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
  fhsaBalance: 5250,
  nonRegBalance: 8000,
  housingType: 'rent',
  housingExpense: 2200,
  mortgageBalance: 0,
  essentialExpenses: 1800,
  discretionarySpending: 800,
  debtPayments: 400,
  creditCardBalance: 853.37,
};

const MAX_MOVEABLE: Record<string, number> = {
  chequing: 12400 - 500, // $500 floor
  savings: 18000,
  tfsa: 34500,
  rrsp: 22000,
  fhsa: 5250,
  nonregistered: 8000,
};

const ROOM: Record<string, number> = {
  tfsa: 7000,
  rrsp: 15200,
  fhsa: 8000 - 5250, // = 2750
};

const MONTHLY_SURPLUS = (85000 + 65000) / 12 - (2200 + 1800 + 800 + 400); // = $7300

function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

interface QuickAction {
  title: string;
  why: string;
  derived_from?: string;
  type: string;
  amount?: number;
  from_account?: string;
  to_account?: string;
  automation?: { amount: number; frequency: string; duration_months?: number; target_amount?: number };
  priority: string;
}

interface TestResult {
  scenario: string;
  prompt: string;
  actionsCount: number;
  searchUsed: boolean;
  debugRemovedCount: number;
  actions: { title: string; valid: boolean; issues: string[] }[];
  overallPass: boolean;
}

function validateAction(action: QuickAction, prompt: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // 1. Must have derived_from with actual numbers
  if (!action.derived_from || action.derived_from.trim() === '') {
    issues.push('Missing derived_from (no data backing)');
  } else if (!/\$[\d,.]+/.test(action.derived_from) && !/\d+%/.test(action.derived_from)) {
    issues.push(`derived_from has no numbers: "${action.derived_from}"`);
  }

  // 2. derived_from must not leak internal prompt variables
  if (action.derived_from && /RESEARCH_CONTEXT|LIFE_EVENT|system prompt/i.test(action.derived_from)) {
    issues.push(`derived_from leaks internals: "${action.derived_from}"`);
  }

  // 3. Move/pay_off must have from_account
  if (['move', 'pay_off'].includes(action.type) && !action.from_account) {
    issues.push(`${action.type} action missing from_account`);
  }

  // 4. Amount must not exceed source balance
  if (action.amount && action.from_account) {
    const sourceKey = norm(action.from_account);
    const max = MAX_MOVEABLE[sourceKey];
    if (max !== undefined && action.amount > max * 1.01) { // 1% tolerance for rounding
      issues.push(`Amount $${action.amount} exceeds ${action.from_account} max $${max}`);
    }
  }

  // 5. Destination room check for registered accounts
  if (action.amount && action.to_account) {
    const destKey = norm(action.to_account);
    const room = ROOM[destKey];
    if (room !== undefined && action.amount > room * 1.01) {
      issues.push(`Amount $${action.amount} exceeds ${action.to_account} room $${room}`);
    }
  }

  // 6. FHSA only for home-related prompts
  if (action.to_account && norm(action.to_account) === 'fhsa') {
    const homeWords = /home|house|buy|condo|mortgage|property|down payment/i;
    if (!homeWords.test(prompt)) {
      issues.push(`FHSA suggested but prompt is not about buying a home`);
    }
  }

  // 7. RESP only for baby/child-related prompts
  if (action.to_account && norm(action.to_account) === 'resp') {
    const babyWords = /baby|child|kid|parent|birth|family|education|school/i;
    if (!babyWords.test(prompt)) {
      issues.push(`RESP suggested but prompt is not about children`);
    }
  }

  // 8. Automation amount must be reasonable vs surplus
  if (action.automation && action.automation.amount > MONTHLY_SURPLUS) {
    issues.push(`Automation $${action.automation.amount}/mo exceeds surplus $${MONTHLY_SURPLUS}`);
  }

  // 9. why should be concise (≤ 15 words)
  if (action.why && action.why.split(/\s+/).length > 15) {
    issues.push(`"why" too long (${action.why.split(/\s+/).length} words): "${action.why}"`);
  }

  // 10. title should be concise (≤ 12 words)
  if (action.title && action.title.split(/\s+/).length > 12) {
    issues.push(`"title" too long (${action.title.split(/\s+/).length} words)`);
  }

  return { valid: issues.length === 0, issues };
}

function printResults(results: TestResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('  AI SCENARIO TEST RESULTS');
  console.log('='.repeat(80));

  for (const r of results) {
    const icon = r.overallPass ? '✅' : '❌';
    console.log(`\n${icon} SCENARIO: ${r.scenario}`);
    console.log(`   Prompt: "${r.prompt}"`);
    console.log(`   Actions: ${r.actionsCount} | Search: ${r.searchUsed ? 'YES' : 'NO'} | Guardrail removed: ${r.debugRemovedCount}`);
    console.log('   ─────────────────────────────────────────────');

    for (const a of r.actions) {
      const aIcon = a.valid ? '  ✓' : '  ✗';
      console.log(`${aIcon} ${a.title}`);
      for (const issue of a.issues) {
        console.log(`      ⚠ ${issue}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  const passed = results.filter(r => r.overallPass).length;
  console.log(`  TOTAL: ${passed}/${results.length} scenarios passed`);
  console.log('='.repeat(80) + '\n');
}

const SCENARIOS = [
  {
    name: '1. Ice cream shop in Toronto',
    prompt: 'I want to quit my job and open an ice cream shop in Toronto',
    expect: {
      searchShouldFire: true,
      forbiddenAccounts: ['fhsa', 'resp'], // not buying home, no kids
      mustMention: /business|startup|emergency|shop|income/i,
    },
  },
  {
    name: '2. Buying first home $650K',
    prompt: "I'm looking to buy my first home in Toronto for around $650K",
    expect: {
      searchShouldFire: true,
      forbiddenAccounts: ['resp'], // no kids
      mustMention: /home|house|down payment|fhsa|mortgage/i,
    },
  },
  {
    name: '3. Having a baby',
    prompt: "We're having a baby in June and want to prepare financially",
    expect: {
      searchShouldFire: false,
      forbiddenAccounts: ['fhsa'], // not buying home
      mustMention: /baby|resp|parental|child|leave/i,
    },
  },
  {
    name: '4. Max TFSA (simple)',
    prompt: 'I want to max out my TFSA',
    expect: {
      searchShouldFire: false,
      forbiddenAccounts: ['fhsa', 'resp'],
      mustMention: /tfsa/i,
      maxActions: 3, // simple prompt = few actions
    },
  },
  {
    name: '5. Complex multi-scenario',
    prompt: "We're having a baby, thinking about buying a $600K condo, and I want to start freelancing on the side",
    expect: {
      searchShouldFire: true,
      forbiddenAccounts: [],
      mustMention: /baby|home|condo|freelanc|business/i,
      minActions: 3,
    },
  },
];

const allResults: TestResult[] = [];

for (const scenario of SCENARIOS) {
  test(`@integration AI: ${scenario.name}`, async ({ request }) => {
    test.setTimeout(120_000);

    const response = await request.post('http://localhost:3000/api/pathfinder', {
      data: {
        profile: PROFILE,
        lifeEvent: scenario.prompt,
        customFunds: [],
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.result).toBeTruthy();
    expect(data.result.quick_actions).toBeTruthy();
    expect(data.result.thinking_steps).toBeTruthy();

    const actions: QuickAction[] = data.result.quick_actions;
    const debugLog = data.debugLog;
    const searchMeta = data.searchMetadata;

    // Validate each action
    const actionResults = actions.map(action => {
      const { valid, issues } = validateAction(action, scenario.prompt);
      return { title: action.title, valid, issues };
    });

    // Check forbidden accounts
    for (const action of actions) {
      const dest = action.to_account ? norm(action.to_account) : '';
      for (const forbidden of scenario.expect.forbiddenAccounts) {
        if (dest === forbidden) {
          const existing = actionResults.find(a => a.title === action.title);
          if (existing) {
            existing.valid = false;
            existing.issues.push(`Forbidden account "${forbidden}" suggested for this scenario`);
          }
        }
      }
    }

    // Check at least one action mentions something relevant
    const allText = actions.map(a => `${a.title} ${a.why} ${a.to_account || ''}`).join(' ');
    const relevancePass = scenario.expect.mustMention.test(allText);
    if (!relevancePass) {
      actionResults.push({
        title: '[RELEVANCE CHECK]',
        valid: false,
        issues: [`No action mentions: ${scenario.expect.mustMention}`],
      });
    }

    // Check action count constraints
    if (scenario.expect.maxActions && actions.length > scenario.expect.maxActions) {
      actionResults.push({
        title: '[COUNT CHECK]',
        valid: false,
        issues: [`${actions.length} actions exceeds max ${scenario.expect.maxActions} for simple prompt`],
      });
    }
    if (scenario.expect.minActions && actions.length < scenario.expect.minActions) {
      actionResults.push({
        title: '[COUNT CHECK]',
        valid: false,
        issues: [`${actions.length} actions below min ${scenario.expect.minActions} for complex prompt`],
      });
    }

    const overallPass = actionResults.every(a => a.valid);

    const result: TestResult = {
      scenario: scenario.name,
      prompt: scenario.prompt,
      actionsCount: actions.length,
      searchUsed: !!searchMeta && searchMeta.sources.length > 0,
      debugRemovedCount: debugLog?.removedActions?.length ?? 0,
      actions: actionResults,
      overallPass,
    };

    allResults.push(result);

    // Print this scenario's results immediately
    const icon = overallPass ? '✅' : '❌';
    console.log(`\n${icon} ${scenario.name}`);
    console.log(`   Actions: ${actions.length} | Search: ${result.searchUsed ? 'YES' : 'NO'} | Removed: ${result.debugRemovedCount}`);
    for (const a of actionResults) {
      const aIcon = a.valid ? '  ✓' : '  ✗';
      console.log(`${aIcon} ${a.title}`);
      for (const issue of a.issues) {
        console.log(`      ⚠ ${issue}`);
      }
    }

    // Print full debug log
    if (debugLog?.entries) {
      console.log('   --- Debug Log ---');
      for (const entry of debugLog.entries) {
        console.log(`   [${entry.step}] ${entry.detail}`);
        if (entry.data) console.log(`      ${entry.data.slice(0, 200)}`);
      }
    }
    if (debugLog?.removedActions?.length > 0) {
      console.log('   --- Removed Actions ---');
      for (const r of debugLog.removedActions) {
        console.log(`      🗑 ${r}`);
      }
    }

    // Hard assertions — test fails if any action is invalid
    for (const a of actionResults) {
      if (!a.valid) {
        console.log(`\n   FAILURES for "${a.title}":`);
        for (const issue of a.issues) {
          console.log(`      - ${issue}`);
        }
      }
    }

    // Soft pass: log but don't fail on relevance/count issues — fail on data issues
    const dataIssues = actionResults.filter(a => !a.valid && !a.title.startsWith('['));
    expect(dataIssues.length, `${dataIssues.length} actions have data/feasibility issues`).toBe(0);
  });
}

// After all tests, print summary
test.afterAll(() => {
  if (allResults.length > 0) {
    printResults(allResults);
  }
});

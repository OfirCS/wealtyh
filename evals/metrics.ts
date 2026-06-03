import { computeDerivedMetrics, getCanadianRuleSet } from '@/lib/prompts';
import { filterThinkingSteps } from '@/lib/pathfinder-engine';
import type { PathfinderResult, FinancialProfile, CustomFund } from '@/lib/types';
import type { EvalScenario } from './scenario-schema';
import { expectedMaxActions } from './scenario-schema';

export interface MetricResult {
  name: string;
  passed: boolean;
  detail: string;
}

const EPS = 0.5;

/** Mirror of the engine's normAccount (src/lib/pathfinder-engine.ts). */
function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function profileBalancesByNorm(profile: FinancialProfile, customFunds: CustomFund[]): Map<string, number> {
  const m = new Map<string, number>([
    ['chequing', profile.chequingBalance],
    ['savings', profile.savingsBalance],
    ['tfsa', profile.tfsaBalance],
    ['rrsp', profile.rrspBalance],
    ['fhsa', profile.fhsaBalance],
    ['nonregistered', profile.nonRegBalance],
  ]);
  for (const f of customFunds) m.set(norm(f.name), f.balance);
  return m;
}

/**
 * Every surviving action must respect the source balance (with the $500
 * chequing floor) and registered-account room — re-derived here from the raw
 * profile, independent of the engine's own ledger.
 */
export function metricBalanceRoomSafety(scenario: EvalScenario, result: PathfinderResult): MetricResult {
  const { profile, customFunds } = scenario;
  const rules = getCanadianRuleSet(scenario.year);
  const m = computeDerivedMetrics(profile, customFunds);

  const sourceAvail = new Map<string, number>([
    ['chequing', Math.max(0, profile.chequingBalance - 500)],
    ['savings', profile.savingsBalance],
    ['tfsa', profile.tfsaBalance],
    ['rrsp', profile.rrspBalance],
    ['fhsa', profile.fhsaBalance],
    ['nonregistered', profile.nonRegBalance],
  ]);
  for (const f of customFunds) sourceAvail.set(norm(f.name), f.balance);

  const roomAvail = new Map<string, number>([
    ['tfsa', profile.tfsaRoom],
    ['rrsp', profile.rrspRoom],
    ['fhsa', m.isFirstTimeBuyer ? Math.max(0, rules.fhsaAnnualRoom - profile.fhsaBalance) : 0],
  ]);

  for (const a of result.quick_actions) {
    const amt = a.amount ?? 0;
    if (amt <= 0) continue;

    if (a.from_account) {
      const key = norm(a.from_account);
      if (sourceAvail.has(key)) {
        const have = sourceAvail.get(key)!;
        if (amt > have + EPS) {
          return { name: 'balance_room_safety', passed: false, detail: `${a.title}: $${amt} exceeds available $${have} in ${a.from_account}` };
        }
        sourceAvail.set(key, have - amt);
      }
    }

    if (a.to_account && (a.type === 'move' || a.type === 'create_fund')) {
      const dkey = norm(a.to_account);
      if (roomAvail.has(dkey)) {
        const room = roomAvail.get(dkey)!;
        if (amt > room + EPS) {
          return { name: 'balance_room_safety', passed: false, detail: `${a.title}: $${amt} exceeds $${room} room in ${a.to_account}` };
        }
        roomAvail.set(dkey, room - amt);
      }
    }
  }

  return { name: 'balance_room_safety', passed: true, detail: `${result.quick_actions.length} actions within balances/room` };
}

/**
 * The surviving thinking steps must be a fixed point of the relevance filter
 * (no further removals), and match the scenario's require/forbid title lists.
 */
export function metricRelevanceFilter(scenario: EvalScenario, result: PathfinderResult): MetricResult {
  const titles = result.thinking_steps.map((s) => s.title);
  const refiltered = filterThinkingSteps(result.thinking_steps, scenario.lifeEvent).map((s) => s.title);

  if (refiltered.length !== titles.length || refiltered.some((t, i) => t !== titles[i])) {
    return { name: 'relevance_filter', passed: false, detail: `not a fixed point: [${titles}] -> [${refiltered}]` };
  }

  for (const want of scenario.expect.requireThinkingTitles ?? []) {
    if (!titles.includes(want)) {
      return { name: 'relevance_filter', passed: false, detail: `missing required step "${want}" (have [${titles}])` };
    }
  }
  for (const banned of scenario.expect.forbidThinkingTitles ?? []) {
    if (titles.includes(banned)) {
      return { name: 'relevance_filter', passed: false, detail: `kept forbidden step "${banned}"` };
    }
  }

  return { name: 'relevance_filter', passed: true, detail: `${titles.length} on-topic steps` };
}

/**
 * Numbers in the final plan must trace to the user's real data: the first
 * cashflow phase equals real surplus, account_impacts carry real current
 * balances (or $0 for newly created funds), and net-worth value equals the
 * sum of action values.
 */
export function metricMathConsistency(scenario: EvalScenario, result: PathfinderResult): MetricResult {
  const { profile, customFunds } = scenario;
  const m = computeDerivedMetrics(profile, customFunds);
  const surplus = Math.round(m.monthlySurplus);

  if (result.monthly_cashflow.length === 0 || Math.abs(result.monthly_cashflow[0].amount - surplus) > EPS) {
    return { name: 'math_consistency', passed: false, detail: `cashflow[0] ${result.monthly_cashflow[0]?.amount} != real surplus ${surplus}` };
  }

  const balByNorm = profileBalancesByNorm(profile, customFunds);
  for (const imp of result.account_impacts) {
    const key = norm(imp.account_name);
    const expected = balByNorm.has(key) ? balByNorm.get(key)! : 0; // new funds start at 0
    if (Math.abs(imp.current_balance - expected) > EPS) {
      return { name: 'math_consistency', passed: false, detail: `${imp.account_name} current_balance ${imp.current_balance} != real ${expected}` };
    }
  }

  let totalValue = 0;
  for (const a of result.quick_actions) {
    if (a.amount && a.amount > 0 && a.type !== 'automate') totalValue += a.amount;
    if (a.type === 'automate' && a.automation && a.automation.amount > 0) {
      totalValue += a.automation.amount * Math.min(12, a.automation.duration_months || 12);
    }
  }
  const reported = Number((result.impact_summary.net_worth_change.value || '').replace(/[^0-9.]/g, '')) || 0;
  if (Math.abs(reported - totalValue) > EPS) {
    return { name: 'math_consistency', passed: false, detail: `net_worth_change ${reported} != action total ${totalValue}` };
  }

  return { name: 'math_consistency', passed: true, detail: `surplus, balances & net-worth all tie to real data` };
}

/** Eligibility / impossible actions the guardrail is expected to have removed. */
export function metricEligibilityRemovals(scenario: EvalScenario, _result: PathfinderResult, removedActions: string[]): MetricResult {
  const wants = scenario.expect.mustRemoveContaining ?? [];
  for (const w of wants) {
    if (!removedActions.some((r) => r.toLowerCase().includes(w.toLowerCase()))) {
      return { name: 'eligibility_removals', passed: false, detail: `expected a removal containing "${w}"; got [${removedActions.join(' | ')}]` };
    }
  }
  if (scenario.expect.expectSplitAutomation) {
    const hasSplit = _result.quick_actions.some((a) => a.type === 'automate' && /auto-deposit/i.test(a.title));
    if (!hasSplit) {
      return { name: 'eligibility_removals', passed: false, detail: 'expected a smart-split auto-deposit for the shortfall' };
    }
  }
  return { name: 'eligibility_removals', passed: true, detail: wants.length ? `removed: ${wants.join(', ')}` : 'no removals expected' };
}

/** Action count must obey the complexity-derived cap. */
export function metricActionCountDiscipline(scenario: EvalScenario, result: PathfinderResult): MetricResult {
  const engineCap = expectedMaxActions(scenario.lifeEvent);
  if (engineCap !== scenario.expect.maxActions) {
    return { name: 'action_count_discipline', passed: false, detail: `derived cap ${engineCap} != expected ${scenario.expect.maxActions}` };
  }
  if (result.quick_actions.length > engineCap) {
    return { name: 'action_count_discipline', passed: false, detail: `${result.quick_actions.length} actions exceed cap ${engineCap}` };
  }
  return { name: 'action_count_discipline', passed: true, detail: `${result.quick_actions.length}/${engineCap} actions` };
}

export const METRIC_NAMES = [
  'balance_room_safety',
  'relevance_filter',
  'math_consistency',
  'eligibility_removals',
  'action_count_discipline',
] as const;

export function scoreScenario(scenario: EvalScenario, result: PathfinderResult, removedActions: string[]): MetricResult[] {
  return [
    metricBalanceRoomSafety(scenario, result),
    metricRelevanceFilter(scenario, result),
    metricMathConsistency(scenario, result),
    metricEligibilityRemovals(scenario, result, removedActions),
    metricActionCountDiscipline(scenario, result),
  ];
}

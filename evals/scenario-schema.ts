import type { FinancialProfile, CustomFund } from '@/lib/types';

/**
 * What a scenario asserts about the pipeline's behaviour. Every field is
 * optional except the action cap, which every scenario pins so we always
 * exercise the complexity-based trimming.
 */
export interface EvalExpectations {
  /** Hard upper bound on surviving quick_actions (engine's complexity cap). */
  maxActions: number;
  /** Substrings that MUST appear in `removedActions` (a guardrail fired). */
  mustRemoveContaining?: string[];
  /** Thinking-step titles that MUST survive the relevance filter. */
  requireThinkingTitles?: string[];
  /** Thinking-step titles that MUST be stripped by the relevance filter. */
  forbidThinkingTitles?: string[];
  /** True if the engine should have synthesised a follow-up automation
   *  to cover a shortfall after capping a move to the available balance. */
  expectSplitAutomation?: boolean;
}

export interface EvalScenario {
  id: string;
  description: string;
  lifeEvent: string;
  profile: FinancialProfile;
  customFunds: CustomFund[];
  /** Canadian rule-set year (rates/limits). Defaults to 2026 if omitted. */
  year: number;
  /**
   * A RECORDED raw model response (pre-guardrail), exactly as the LLM would
   * emit it — sometimes markdown-fenced, sometimes containing deliberate
   * violations the deterministic layer must catch. We never call a live model
   * in the eval; we replay this string through the real pipeline.
   */
  rawAiResponse: string;
  expect: EvalExpectations;
}

/**
 * The engine's action-count discipline, mirrored here so the eval verifies the
 * contract independently rather than trusting the implementation. Kept in sync
 * with `applyPostParseGuardrails` in src/lib/pathfinder-engine.ts.
 */
export function expectedMaxActions(lifeEvent: string): number {
  const separators = /\b(and|plus|also|,)\b/gi;
  const subSituations = lifeEvent.split(separators).filter((s) => s.trim().length > 10);
  const isComplex = subSituations.length >= 3;
  const wordCount = lifeEvent.split(/\s+/).length;
  const isSimple = subSituations.length <= 1 && wordCount <= 6;
  return isComplex ? 7 : isSimple ? 2 : 4;
}

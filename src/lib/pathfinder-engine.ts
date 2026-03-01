import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { buildPathfinderSystemPrompt, buildUserMessage, computeDerivedMetrics, getCanadianRuleSet } from '@/lib/prompts';
import type { DerivedMetrics } from '@/lib/prompts';
import type { FinancialProfile, CustomFund, PathfinderResult, SearchMetadata, SearchSource, PathfinderAPIResult, QuickAction, DebugLog, DebugLogEntry } from '@/lib/types';

// ── AI Client helpers ────────────────────────────────────────────────────────

/** Call Claude (primary) with automatic Gemini fallback */
async function callAI(opts: {
  system: string;
  userMessage: string;
  model: 'fast' | 'main';
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const { system, userMessage, model, temperature = 0.3, maxTokens = 4096 } = opts;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GOOGLE_API_KEY;

  // Try Claude first
  if (anthropicKey) {
    try {
      const claude = new Anthropic({ apiKey: anthropicKey });
      const claudeModel = model === 'fast' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6';
      console.info(`[AI] Calling Claude ${claudeModel}...`);
      const msg = await claude.messages.create({
        model: claudeModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }],
        temperature,
      });
      const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
      if (text) {
        console.info(`[AI] Claude responded (${text.length} chars)`);
        return text;
      }
      console.warn('[AI] Claude returned empty response, falling back to Gemini');
    } catch (err) {
      console.warn('[AI] Claude failed, falling back to Gemini:', err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback: Gemini
  if (!geminiKey) throw new Error('No AI API keys configured. Set ANTHROPIC_API_KEY or GOOGLE_API_KEY.');
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const geminiModel = model === 'fast' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
  console.info(`[AI] Falling back to Gemini ${geminiModel}...`);
  const response = await ai.models.generateContent({
    model: geminiModel,
    contents: userMessage,
    config: {
      systemInstruction: system,
      temperature,
      maxOutputTokens: maxTokens,
    },
  });
  return response.text ?? '';
}

type RuleSet = ReturnType<typeof getCanadianRuleSet>;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    const firstNewline = cleaned.indexOf('\n');
    if (firstNewline !== -1) cleaned = cleaned.slice(firstNewline + 1);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3).trimEnd();
  }
  return cleaned.trim();
}

export function parsePathfinderResult(rawText: string): PathfinderResult {
  const cleaned = stripMarkdownFences(rawText);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: extract first complete JSON object from the text
    const startIdx = cleaned.indexOf('{');
    const lastIdx = cleaned.lastIndexOf('}');
    if (startIdx !== -1 && lastIdx > startIdx) {
      try {
        parsed = JSON.parse(cleaned.slice(startIdx, lastIdx + 1));
      } catch (e2) {
        console.error('JSON Parse Error (fallback):', e2);
        console.error('Raw content:', rawText.slice(0, 500));
        throw new Error('Failed to parse AI response as JSON');
      }
    } else {
      console.error('No JSON object found in response');
      console.error('Raw content:', rawText.slice(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  const requiredKeys: (keyof PathfinderResult)[] = [
    'thinking_steps',
    'impact_summary',
    'quick_actions',
    'advisor_flags',
    'risk_warnings',
    'monthly_cashflow',
  ];

  for (const key of requiredKeys) {
    if (!(key in parsed)) {
      throw new Error(`Missing required key in Pathfinder result: ${key}`);
    }
  }

  return parsed as PathfinderResult;
}

// ── Thinking Steps Relevance Filter ─────────────────────────────────────────

const GENERIC_THINKING_PATTERNS = [
  /cash\s*flow/i,
  /^(critical|current|overall|immediate|urgent)\b/i,
  /liquid\s*(position|assets)/i,
  /financial\s*(health|position|snapshot|overview|summary|status|reality)/i,
  /net\s*worth/i,
  /balance\s*(check|overview|summary)/i,
  /income\s*(vs|versus|analysis|check|overview|gap)/i,
  /expense\s*(analysis|check|overview|breakdown)/i,
  /spending\s*(analysis|overview|check)/i,
  /budget\s*(analysis|overview|check|gap)/i,
  /emergency\s*(fund|buffer|reserve|savings)/i,
  /action\s*required/i,
  /debt.*sustain/i,
  /housing.*sustain/i,
];

function filterThinkingSteps(steps: ThinkingStep[], lifeEvent: string): ThinkingStep[] {
  const eventLower = lifeEvent.toLowerCase();

  // Detect intent: is the user abandoning a goal?
  // Include common typos: "dont" for "done", "im" for "I'm"
  const isAbandoning = /\b(don[e']?t? with|done with|giving up|gave up|cancel|forget|stop trying|quit|not anymore|changed my mind|don'?t want|no longer|over it|moving on|leaving|abandon|scrap|ditch|drop)\b/i.test(eventLower);
  const abandonedTopics: string[] = [];
  if (isAbandoning) {
    if (/house|home|condo|buy|first.?time|fhsa|down.?payment|mortgage/i.test(eventLower)) abandonedTopics.push('home', 'house', 'mortgage', 'down payment', 'fhsa', 'buyer', 'hbp', 'first-time', 'first time', 'home purchase', 'home buying', 'feasib', 'rent vs buy');
    if (/business|startup|freelance|entrepreneur/i.test(eventLower)) abandonedTopics.push('business', 'startup', 'runway', 'incorporation');
    if (/baby|child|parent/i.test(eventLower)) abandonedTopics.push('baby', 'parental', 'resp', 'childcare');
  }

  const notAbandoned = (topic: string) => !abandonedTopics.includes(topic);
  const eventIsAboutBudget = /budget|spend|save more|cut (expenses|costs)|reduce spending/i.test(eventLower);
  const eventIsAboutHome = notAbandoned('home') && /home|house|condo|buy.*first|first.?time.?buy|fhsa|down\s*payment|mortgage/i.test(eventLower);
  const eventIsAboutDebt = /debt|credit\s*card|pay\s*off|interest/i.test(eventLower);
  const eventIsAboutEmergency = /emergency|rainy\s*day|safety\s*net/i.test(eventLower);

  // Build pursued event topics
  const eventTopics: string[] = [];
  if (/baby|child|kid|parent|pregnan|mat(ernity|leave)|pat(ernity|leave)|newborn/i.test(eventLower) && notAbandoned('baby')) eventTopics.push('baby', 'parental', 'resp', 'leave', 'childcare', 'ei ', 'nursery', 'diaper');
  if (eventIsAboutHome) eventTopics.push('home', 'house', 'mortgage', 'down payment', 'fhsa', 'buyer', 'hbp');
  if (/business|startup|freelance|entrepreneur|self.?employ|quit.*(job|work)|career\s*change/i.test(eventLower) && notAbandoned('business')) eventTopics.push('business', 'startup', 'runway', 'revenue', 'incorporation', 'freelance');
  if (/retire|retirement/i.test(eventLower)) eventTopics.push('retire', 'rrsp', 'pension', 'cpp');
  if (/travel|sabbatical|gap\s*year/i.test(eventLower)) eventTopics.push('travel', 'relocat', 'cost of living');
  if (eventIsAboutDebt) eventTopics.push('debt', 'credit', 'interest', 'pay off');
  if (/invest|tfsa|rrsp|portfolio|stock|etf/i.test(eventLower)) eventTopics.push('invest', 'tfsa', 'rrsp', 'portfolio', 'growth');
  if (/wedding|married|marriage/i.test(eventLower)) eventTopics.push('wedding', 'marriage', 'partner');
  if (/move.*(to|from|everything)|transfer|consolidat/i.test(eventLower)) eventTopics.push('transfer', 'move', 'consolidat', 'withdraw', 'realloc');

  let filtered = steps.filter((step) => {
    const titleLower = step.title.toLowerCase();
    const allText = (step.title + ' ' + step.insights.map(i => i.text).join(' ')).toLowerCase();

    // Remove steps about abandoned topics (except exit strategy steps)
    if (abandonedTopics.length > 0) {
      const isAboutAbandoned = abandonedTopics.some((t) => titleLower.includes(t));
      if (isAboutAbandoned) {
        const isExitStrategy = /withdraw|tax|penalt|forfeit|close|liquidat|repurpos|move out|cash out/i.test(allText);
        if (!isExitStrategy) {
          console.warn(`[ThinkingFilter] Removed abandoned-goal step: "${step.title}"`);
          return false;
        }
      }
    }

    // Keep steps that match pursued event topics
    if (eventTopics.some((t) => titleLower.includes(t))) return true;
    const insightMatchesEvent = eventTopics.some((t) => allText.includes(t));

    // Remove generic audit steps
    const isGeneric = GENERIC_THINKING_PATTERNS.some((p) => p.test(titleLower));
    if (isGeneric && !insightMatchesEvent) {
      console.warn(`[ThinkingFilter] Removed generic step: "${step.title}"`);
      return false;
    }

    // Remove home-buying steps if event isn't about home
    if (!eventIsAboutHome && (titleLower.includes('first-time') || titleLower.includes('first time') || titleLower.includes('buyer') || titleLower.includes('fhsa') || titleLower.includes('rent vs buy'))) {
      console.warn(`[ThinkingFilter] Removed irrelevant home step: "${step.title}"`);
      return false;
    }

    // Remove debt/emergency steps if irrelevant
    if (!eventIsAboutDebt && !eventIsAboutBudget && /^debt/i.test(titleLower)) return false;
    if (!eventIsAboutEmergency && !eventIsAboutBudget && /emergency/i.test(titleLower) && !insightMatchesEvent) return false;

    return true;
  });

  // Ensure at least 1 step
  if (filtered.length === 0) {
    filtered = [{ title: 'Analyzing Impact', insights: [{ text: `Evaluating impact of this change`, type: 'neutral' }] }];
  }

  return filtered;
}

// ── Post-Parse Guardrails ───────────────────────────────────────────────────

/** Normalise account name for matching */
function normAccount(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

/** Strip leaked prompt internals from derived_from text */
function sanitizeDerivedFrom(text: string): string {
  return text
    .replace(/\bRESEARCH_CONTEXT\b/gi, 'live data')
    .replace(/\bLIFE_EVENT\b/gi, 'your scenario')
    .replace(/\bsystem prompt\b/gi, 'guidelines')
    .trim();
}

/**
 * Build a mutable ledger of available balances.
 * As each action is validated, its cost is deducted so later actions
 * see the REMAINING balance — not the original.
 */
function buildBalanceLedger(
  profile: FinancialProfile,
  customFunds: CustomFund[],
): Map<string, number> {
  const ledger = new Map<string, number>();
  ledger.set('chequing', Math.max(0, profile.chequingBalance - 500)); // keep $500 floor
  ledger.set('savings', profile.savingsBalance);
  ledger.set('tfsa', profile.tfsaBalance);
  ledger.set('rrsp', profile.rrspBalance);
  ledger.set('fhsa', profile.fhsaBalance);
  ledger.set('nonregistered', profile.nonRegBalance);
  for (const fund of customFunds) {
    ledger.set(normAccount(fund.name), fund.balance);
  }
  return ledger;
}

function buildRoomLedger(
  profile: FinancialProfile,
  metrics: DerivedMetrics,
  rules: RuleSet,
): Map<string, number> {
  const ledger = new Map<string, number>();
  ledger.set('tfsa', profile.tfsaRoom);
  ledger.set('rrsp', profile.rrspRoom);
  ledger.set('fhsa', metrics.isFirstTimeBuyer ? Math.max(0, rules.fhsaAnnualRoom - profile.fhsaBalance) : 0);
  ledger.set('resp', rules.respAnnualContributionForMaxCesg);
  return ledger;
}

function resolveLedgerKey(name: string, ledger: Map<string, number>): string | null {
  const requested = normAccount(name);
  if (!requested) return null;
  if (ledger.has(requested)) return requested;

  const partialMatches = Array.from(ledger.keys()).filter(
    (key) => key.includes(requested) || requested.includes(key),
  );
  if (partialMatches.length === 1) return partialMatches[0];
  if (partialMatches.length > 1) {
    return partialMatches.sort(
      (a, b) => Math.abs(a.length - requested.length) - Math.abs(b.length - requested.length),
    )[0];
  }

  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  if (tokens.length > 0) {
    const tokenMatches = Array.from(ledger.keys())
      .map((key) => ({
        key,
        overlap: tokens.filter((token) => key.includes(token)).length,
        lengthDelta: Math.abs(key.length - requested.length),
      }))
      .filter((candidate) => candidate.overlap > 0)
      .sort((a, b) => {
        if (b.overlap !== a.overlap) return b.overlap - a.overlap;
        return a.lengthDelta - b.lengthDelta;
      });

    if (tokenMatches.length === 1) return tokenMatches[0].key;
    if (tokenMatches.length > 1 && tokenMatches[0].overlap > tokenMatches[1].overlap) {
      return tokenMatches[0].key;
    }
  }

  return null;
}

export function applyPostParseGuardrails(
  result: PathfinderResult,
  profile: FinancialProfile,
  customFunds: CustomFund[],
  lifeEvent: string,
  rules: RuleSet,
  removedActions: string[] = [],
): PathfinderResult {
  const metrics = computeDerivedMetrics(profile, customFunds);
  const balanceLedger = buildBalanceLedger(profile, customFunds);
  const roomLedger = buildRoomLedger(profile, metrics, rules);
  const displayNameByNorm = new Map<string, string>([
    ['chequing', 'Chequing'],
    ['savings', 'Savings'],
    ['tfsa', 'TFSA'],
    ['rrsp', 'RRSP'],
    ['fhsa', 'FHSA'],
    ['nonregistered', 'Non-Registered'],
  ]);
  for (const fund of customFunds) {
    displayNameByNorm.set(normAccount(fund.name), fund.name);
  }

  const validated: QuickAction[] = [];
  const splitActions: QuickAction[] = [];

  for (const action of result.quick_actions) {
    const sourceKey = action.from_account ? resolveLedgerKey(action.from_account, balanceLedger) : null;
    const destKey = action.to_account ? normAccount(action.to_account) : null;

    if (sourceKey && action.from_account) {
      const canonicalSource = displayNameByNorm.get(sourceKey);
      if (canonicalSource) action.from_account = canonicalSource;
    }

    // ── FHSA eligibility ──
    if (destKey === 'fhsa' && !metrics.isFirstTimeBuyer) {
      removedActions.push(`"${action.title}" — not first-time buyer`);
      continue;
    }

    // ── Pay-off: debt must exist ──
    if (action.type === 'pay_off') {
      const hint = (action.to_account || action.title || '').toLowerCase();
      if ((hint.includes('credit') || hint.includes('card')) && profile.creditCardBalance <= 0) {
        removedActions.push(`"${action.title}" — no credit card balance`);
        continue;
      }
      if (hint.includes('mortgage') && profile.mortgageBalance <= 0) {
        removedActions.push(`"${action.title}" — no mortgage`);
        continue;
      }
    }

    // ── Automation: surplus must support it ──
    if (action.type === 'automate' && action.automation) {
      if (metrics.monthlySurplus < 100) {
        removedActions.push(`"${action.title}" — surplus too low ($${Math.round(metrics.monthlySurplus)})`);
        continue;
      }
      if (action.automation.amount > metrics.monthlySurplus * 0.9) {
        // Cap the automation amount to 80% of surplus instead of removing
        action.automation.amount = Math.round(metrics.monthlySurplus * 0.8);
        console.warn(`[Guardrail] Capped automation "${action.title}" to $${action.automation.amount}/mo`);
      }
    }

    // ── Source balance check (against running ledger) ──
    if (action.from_account && action.amount && action.amount > 0) {
      if (!sourceKey) {
        // Source account not found in ledger — AI hallucinated or misspelled the account name
        console.warn(`[Guardrail] Removed "${action.title}" — source "${action.from_account}" not found in any account`);
        removedActions.push(`"${action.title}" — unknown source account "${action.from_account}"`);
        continue;
      }

      const available = balanceLedger.get(sourceKey) ?? 0;
      if (available <= 0) {
        removedActions.push(`"${action.title}" — ${action.from_account} has $0 left`);
        continue;
      }
      if (action.amount > available) {
        const shortfall = action.amount - available;
        console.warn(`[Guardrail] Capped "${action.title}": $${action.amount} → $${available} (remaining in ${action.from_account})`);
        action.amount = available;
        action.title = action.title.replace(/\$[\d,.]+/, `$${available.toLocaleString('en-CA')}`);

        // Smart split: create automation for the shortfall if user has surplus
        if (action.type === 'move' && metrics.monthlySurplus > 200) {
          const monthlyAmt = Math.min(
            Math.round(shortfall / 6),
            Math.round(metrics.monthlySurplus * 0.5),
          );
          if (monthlyAmt > 0) {
            const months = Math.ceil(shortfall / monthlyAmt);
            splitActions.push({
              title: `Auto-deposit $${monthlyAmt.toLocaleString('en-CA')}/mo → ${action.to_account}`,
              why: `Builds remaining $${shortfall.toLocaleString('en-CA')} over ${months}mo`,
              derived_from: `$${shortfall.toLocaleString('en-CA')} shortfall ÷ $${monthlyAmt}/mo = ${months}mo`,
              type: 'automate',
              from_account: action.from_account,
              to_account: action.to_account,
              automation: { amount: monthlyAmt, frequency: 'monthly', duration_months: months, target_amount: shortfall },
              priority: 'this_month',
            });
          }
        }
      }
    }

    // ── Destination room check (against running room ledger) ──
    if (destKey && action.amount && action.amount > 0 && (action.type === 'move' || action.type === 'create_fund')) {
      const room = roomLedger.get(destKey);
      if (room !== undefined) {
        if (room <= 0) {
          removedActions.push(`"${action.title}" — $0 room in ${action.to_account}`);
          continue;
        }
        if (action.amount > room) {
          console.warn(`[Guardrail] Capped "${action.title}" to room: $${action.amount} → $${room} (${action.to_account})`);
          action.amount = room;
          action.title = action.title.replace(/\$[\d,.]+/, `$${room.toLocaleString('en-CA')}`);
        }
      }
    }

    // ── Remove $0 or negative amount actions ──
    if ((action.type === 'move' || action.type === 'pay_off') && action.amount !== undefined && action.amount <= 0) {
      removedActions.push(`"${action.title}" — capped to $0`);
      continue;
    }

    // ── DEDUCT from ledgers so the next action sees remaining balance ──
    if (sourceKey && action.amount && action.amount > 0) {
      const prev = balanceLedger.get(sourceKey) ?? 0;
      balanceLedger.set(sourceKey, Math.max(0, prev - action.amount));
    }
    if (destKey && action.amount && action.amount > 0) {
      const prevRoom = roomLedger.get(destKey);
      if (prevRoom !== undefined) {
        roomLedger.set(destKey, Math.max(0, prevRoom - action.amount));
      }
    }

    // ── Sanitize derived_from ──
    action.derived_from = sanitizeDerivedFrom(action.derived_from || '');

    // ── Ensure derived_from includes $ amounts ──
    if (action.amount && !action.derived_from.includes('$')) {
      if (action.from_account && action.to_account) {
        action.derived_from = `${action.from_account} $${action.amount.toLocaleString('en-CA')} → ${action.to_account}`;
      }
    }

    validated.push(action);
  }

  result.quick_actions = [...validated, ...splitActions];

  // ── Deduplicate moves: only merge if SAME source AND SAME destination ──
  const seenKey = new Map<string, number>();
  const deduped: QuickAction[] = [];
  for (const action of result.quick_actions) {
    if (action.type === 'move' && action.to_account && action.from_account) {
      const key = `${normAccount(action.from_account)}→${normAccount(action.to_account)}`;
      if (seenKey.has(key)) {
        const firstIdx = seenKey.get(key)!;
        const first = deduped[firstIdx];
        const combinedAmount = (first.amount ?? 0) + (action.amount ?? 0);
        first.amount = combinedAmount;
        first.title = first.title.replace(/\$[\d,.]+/, `$${combinedAmount.toLocaleString('en-CA')}`);
        first.why = [first.why, action.why].filter(Boolean).join('. ');
      } else {
        seenKey.set(key, deduped.length);
        deduped.push(action);
      }
    } else {
      deduped.push(action);
    }
  }
  result.quick_actions = deduped;

  // ── Dynamic action count limit based on prompt complexity ──
  const separators = /\b(and|plus|also|,)\b/gi;
  const subSituations = lifeEvent.split(separators).filter(s => s.trim().length > 10);
  const isComplex = subSituations.length >= 3;
  // Simple = very short, single-verb requests like "max TFSA", "pay off credit card"
  const wordCount = lifeEvent.split(/\s+/).length;
  const isSimple = subSituations.length <= 1 && wordCount <= 6;
  const maxActions = isComplex ? 7 : isSimple ? 2 : 4;

  if (result.quick_actions.length > maxActions) {
    console.warn(`[Guardrail] Trimmed from ${result.quick_actions.length} to ${maxActions} (complexity: ${isComplex ? 'complex' : isSimple ? 'simple' : 'moderate'}, words: ${wordCount})`);
    result.quick_actions = result.quick_actions.slice(0, maxActions);
  }

  // ── Rebuild account_impacts from REAL balances + validated actions ──
  const actualBalances: Record<string, number> = {
    'Chequing': profile.chequingBalance,
    'Savings': profile.savingsBalance,
    'TFSA': profile.tfsaBalance,
    'RRSP': profile.rrspBalance,
    'FHSA': profile.fhsaBalance,
    'Non-Registered': profile.nonRegBalance,
  };
  for (const fund of customFunds) {
    actualBalances[fund.name] = fund.balance;
  }

  // Compute net deltas per account from the validated actions
  const accountDeltas = new Map<string, number>();
  for (const action of result.quick_actions) {
    const amount = action.amount ?? 0;
    if (amount <= 0) continue;

    // Withdrawals from source
    if (action.from_account) {
      const srcNorm = normAccount(action.from_account);
      accountDeltas.set(srcNorm, (accountDeltas.get(srcNorm) ?? 0) - amount);
    }
    // Deposits to destination (for move, create_fund, open_account)
    if (action.to_account && (action.type === 'move' || action.type === 'create_fund' || action.type === 'open_account')) {
      const destNorm = normAccount(action.to_account);
      accountDeltas.set(destNorm, (accountDeltas.get(destNorm) ?? 0) + amount);
    }
    // Automations: show first month impact
    if (action.type === 'automate' && action.automation && action.automation.amount > 0) {
      const autoAmt = action.automation.amount;
      const srcNorm = action.from_account ? normAccount(action.from_account) : 'chequing';
      accountDeltas.set(srcNorm, (accountDeltas.get(srcNorm) ?? 0) - autoAmt);
      if (action.to_account) {
        const destNorm = normAccount(action.to_account);
        accountDeltas.set(destNorm, (accountDeltas.get(destNorm) ?? 0) + autoAmt);
      }
    }
    // Pay-off: reduce credit card debt
    if (action.type === 'pay_off') {
      accountDeltas.set('creditcard', (accountDeltas.get('creditcard') ?? 0) - amount);
    }
  }

  // Build a lookup of AI hints (impact_text, note) keyed by normalized account name
  const aiHints = new Map<string, { impact_text: string; note?: string }>();
  if (result.account_impacts) {
    for (const impact of result.account_impacts) {
      aiHints.set(normAccount(impact.account_name), {
        impact_text: impact.impact_text,
        note: impact.note,
      });
    }
  }

  // Rebuild account_impacts from real data + computed deltas
  const computedImpacts: typeof result.account_impacts = [];
  for (const [name, currentBalance] of Object.entries(actualBalances)) {
    const norm = normAccount(name);
    const delta = accountDeltas.get(norm) ?? 0;
    if (delta === 0) continue; // Only show accounts affected by actions

    let projected = currentBalance + delta;

    // Cap registered accounts to room
    if (norm === 'tfsa') {
      projected = Math.min(projected, profile.tfsaBalance + profile.tfsaRoom);
    } else if (norm === 'rrsp') {
      projected = Math.min(projected, profile.rrspBalance + profile.rrspRoom);
    } else if (norm === 'fhsa') {
      projected = Math.min(
        projected,
        Math.min(
          rules.fhsaLifetimeRoom,
          profile.fhsaBalance + Math.max(0, rules.fhsaAnnualRoom - profile.fhsaBalance),
        ),
      );
    }
    // Credit card can't go below 0
    if (norm === 'creditcard') {
      projected = Math.max(0, profile.creditCardBalance + delta);
    }
    projected = Math.max(0, projected);

    const hint = aiHints.get(norm);
    const status = projected > currentBalance ? 'positive' : projected < currentBalance ? 'negative' : 'neutral';

    computedImpacts.push({
      account_name: name,
      current_balance: currentBalance,
      projected_balance: Math.round(projected),
      impact_text: hint?.impact_text ?? (delta > 0 ? `+$${delta.toLocaleString('en-CA')} from actions` : `-$${Math.abs(delta).toLocaleString('en-CA')} from actions`),
      status: norm === 'creditcard' && delta < 0 ? 'positive' : status, // Paying off debt is positive
      note: hint?.note,
    });
  }

  // Also add impacts for NEW funds created by actions (not in profile yet)
  for (const [normName, delta] of accountDeltas.entries()) {
    if (delta <= 0) continue;
    const alreadyIncluded = Object.keys(actualBalances).some(k => normAccount(k) === normName);
    if (alreadyIncluded) continue;
    // Find the display name from the action
    const displayName = result.quick_actions.find(
      a => a.to_account && normAccount(a.to_account) === normName
    )?.to_account ?? normName;
    const hint = aiHints.get(normName);
    computedImpacts.push({
      account_name: displayName,
      current_balance: 0,
      projected_balance: Math.round(delta),
      impact_text: hint?.impact_text ?? `New fund: $${delta.toLocaleString('en-CA')}`,
      status: 'positive',
      note: hint?.note,
    });
  }

  result.account_impacts = computedImpacts;

  // ── Rebuild monthly_cashflow from real surplus + action automations ──
  const actualSurplus = Math.round(metrics.monthlySurplus);

  // Sum up monthly automation amounts from validated actions
  let totalMonthlyAutomation = 0;
  for (const action of result.quick_actions) {
    if (action.type === 'automate' && action.automation && action.automation.amount > 0) {
      totalMonthlyAutomation += action.automation.amount;
    }
  }

  if (result.monthly_cashflow && result.monthly_cashflow.length > 0) {
    // Coerce all amounts to numbers and track original AI predictions
    const originalAiAmounts = result.monthly_cashflow.map(entry => {
      let val = 0;
      if (typeof entry.amount === 'string') {
        const stripped = (entry.amount as string).replace(/[^0-9.\-]/g, '');
        val = Number(stripped) || 0;
      } else {
        val = Number(entry.amount) || 0;
      }
      entry.amount = val;
      return val;
    });

    const aiPhase1 = originalAiAmounts[0] || 0;

    // Fix first phase strictly to actual surplus
    result.monthly_cashflow[0].amount = actualSurplus;

    // Scale subsequent phases based on the AI's relative predicted drop/gain
    for (let i = 1; i < result.monthly_cashflow.length; i++) {
      // If this is phase 2 AND there is an automation, enforce actualSurplus - automations mathematically
      if (i === 1 && totalMonthlyAutomation > 0) {
        result.monthly_cashflow[i].amount = actualSurplus - totalMonthlyAutomation;
      } else {
        // Otherwise, preserve the AI's intuition (e.g. mortgage costs, income drops) by applying the relative delta to the real surplus
        const aiRelativeDelta = originalAiAmounts[i] - aiPhase1;
        result.monthly_cashflow[i].amount = actualSurplus + aiRelativeDelta;
      }
    }
  } else {
    // AI didn't provide cashflow at all — build from scratch
    const phases: typeof result.monthly_cashflow = [
      { phase: 'Current', amount: actualSurplus },
    ];
    if (totalMonthlyAutomation > 0) {
      phases.push({ phase: 'After plan', amount: actualSurplus - totalMonthlyAutomation });
    }
    result.monthly_cashflow = phases;
  }

  // ── Tie Net Worth Summary to REAL Action Value ──
  // To avoid confusing hallucinations, "Plan Value" will directly equal the sum of actions being executed 
  let totalActionValue = 0;
  for (const action of result.quick_actions) {
    if (action.amount && action.amount > 0 && action.type !== 'automate') {
      totalActionValue += action.amount;
    }
    // Also add the first year of automations
    if (action.type === 'automate' && action.automation && action.automation.amount > 0) {
      const months = action.automation.duration_months || 12;
      totalActionValue += (action.automation.amount * Math.min(12, months));
    }
  }

  if (result.impact_summary && result.impact_summary.net_worth_change) {
    result.impact_summary.net_worth_change.value = `+$${totalActionValue.toLocaleString('en-CA')}`;
    result.impact_summary.net_worth_change.type = 'positive';
    result.impact_summary.net_worth_change.label = 'Value directed';
  }

  // ── Filter thinking_steps for relevance to the life event ──
  if (result.thinking_steps && result.thinking_steps.length > 0) {
    result.thinking_steps = filterThinkingSteps(result.thinking_steps, lifeEvent);
  }

  return result;
}

// ── Step 1: Router ───────────────────────────────────────────────────────────

function buildRouterPrompt(
  profile: FinancialProfile,
  customFunds: CustomFund[],
): string {
  const m = computeDerivedMetrics(profile, customFunds);
  const rules = getCanadianRuleSet();
  const customFundNames = customFunds.map(f => f.name).join(', ') || 'none';

  return `You are a financial planning router. You receive a user's full financial context and a life event. Decide whether CURRENT internet data would materially change the recommended dollar amounts or strategy.

## CRITICAL: Understand Intent Before Searching
Read the life event CAREFULLY. Detect whether the user is:
- **PURSUING** a goal → search for info about that goal
- **ABANDONING/PIVOTING** a goal → DO NOT search for the old goal. The user is DONE with it.
  - Signals: "done with", "giving up", "cancel", "forget about", "not anymore", "changed my mind", "switch from", "stop trying to"
  - Example: "I'm done with buying a house, move everything to chequing" → The user is NOT buying a house. Do NOT search for mortgage rates or home prices. The action is a simple fund reallocation — no search needed.
  - Example: "forget the business, I want to travel instead" → Search for TRAVEL costs, not business costs.

## Principle
Ask yourself: "Would last year's numbers give wrong advice?" If yes → search.

SEARCH when the plan depends on:
- Current interest rates, GIC rates, mortgage rates (change weekly)
- Housing prices in a specific city or region
- Tuition or program costs at specific institutions
- Government program updates that may have changed recently
- Insurance premiums or quotes
- Specific business startup costs, licensing fees, industry data
- Cost of living in a specific city (for relocation)
- Current market conditions affecting investment strategy

DO NOT SEARCH for:
- Tax bracket math (stable, already in system prompt)
- TFSA/RRSP/FHSA/RESP rules and limits (already in system prompt for ${rules.year})
- Standard EI/CCB formulas (already in system prompt)
- General budgeting or savings rate calculations
- The user's own numbers (already provided)
- Goals the user is ABANDONING (see intent detection above)
- Simple fund moves/transfers between the user's own accounts

When in doubt: search. Cost is 1-2s latency; stale data leads to wrong dollar amounts.

## User Context
- Income: $${profile.annualIncome}/yr, Partner: $${profile.partnerIncome}/yr
- Province: ${profile.province}, Employment: ${profile.employmentType}
- Liquid: $${m.liquidAssets}, Invested: $${m.investedAssets}, Net worth: $${Math.round(m.totalNetWorth)}
- Surplus: $${Math.round(m.monthlySurplus)}/mo (${m.savingsRate}% savings rate)
- Emergency fund: ${m.emergencyFundMonths} months
- TFSA deposit room (contribution space, NOT balance): $${profile.tfsaRoom}, RRSP deposit room: $${profile.rrspRoom}
- FHSA balance: $${profile.fhsaBalance}${m.isFirstTimeBuyer ? ' (first-time buyer)' : ''}
- Housing: ${profile.housingType}, $${profile.housingExpense}/mo${profile.mortgageBalance > 0 ? `, mortgage: $${profile.mortgageBalance}` : ''}
- Debt payments: $${profile.debtPayments}/mo${profile.creditCardBalance > 0 ? `, credit card: $${profile.creditCardBalance.toFixed(2)}` : ''}
- Custom funds: ${customFundNames}

## Output
Return ONLY valid JSON, no markdown fences:
{ "needs_search": true/false, "reasoning": "one sentence why", "queries": ["search query 1", ...] }

If searching, return 1-3 focused, specific, Canadian-focused queries.`;
}

export interface RouterResult {
  needs_search: boolean;
  queries: string[];
}

export async function routeQuery(
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[],
): Promise<RouterResult> {
  const routerPrompt = buildRouterPrompt(profile, customFunds);

  const text = await callAI({
    system: routerPrompt,
    userMessage: `LIFE_EVENT: ${lifeEvent}`,
    model: 'fast',
    temperature: 0,
    maxTokens: 256,
  });

  try {
    const cleaned = stripMarkdownFences(text.trim());
    const parsed = JSON.parse(cleaned);
    if (parsed.reasoning) {
      console.info('[Router] Reasoning:', parsed.reasoning);
    }
    return {
      needs_search: Boolean(parsed.needs_search),
      queries: Array.isArray(parsed.queries) ? parsed.queries.slice(0, 3) : [],
    };
  } catch {
    console.warn('[Router] Failed to parse, skipping search:', text.slice(0, 200));
    return { needs_search: false, queries: [] };
  }
}

// ── Step 2: Search ───────────────────────────────────────────────────────────

export interface SearchResult {
  text: string;
  metadata: SearchMetadata;
}

/** Search always uses Gemini (for Google grounding / web search tool) */
export async function searchForContext(
  queries: string[],
): Promise<SearchResult> {
  const geminiKey = process.env.GOOGLE_API_KEY;
  if (!geminiKey) throw new Error('GOOGLE_API_KEY required for web search');
  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const combined = queries.join('\n- ');
  const prompt = `Research the following topics and provide a concise factual summary for each. Include specific numbers, dates, and sources where possible. Keep each topic to 2-3 sentences.

Topics:
- ${combined}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0,
      maxOutputTokens: 1024,
    },
  });

  const text = response.text ?? '';
  const sources: SearchSource[] = [];
  const searchQueries: string[] = [];

  // Debug: log raw response structure to diagnose grounding issues
  console.info('[Search] Response keys:', Object.keys(response));
  console.info('[Search] Candidates:', JSON.stringify(response.candidates?.map(c => Object.keys(c)), null, 2));
  const grounding = response.candidates?.[0]?.groundingMetadata;
  console.info('[Search] Grounding metadata:', grounding ? Object.keys(grounding) : 'null');
  if (grounding?.webSearchQueries) {
    searchQueries.push(...grounding.webSearchQueries);
    console.info('[Search] Queries used:', grounding.webSearchQueries);
  }
  if (grounding?.groundingChunks) {
    for (const chunk of grounding.groundingChunks) {
      if (chunk.web?.uri) {
        sources.push({ title: chunk.web.title, url: chunk.web.uri });
      }
    }
    console.info('[Search] Sources:', sources.slice(0, 5).map(s => s.url));
  }

  return {
    text,
    metadata: { queries: searchQueries, sources: sources.slice(0, 8) },
  };
}

// ── Pre-Think (fast thinking preview) ────────────────────────────────────────

import type { ThinkingStep } from '@/lib/types';

const THINKING_PREVIEW_PROMPT = `You are a financial analyst. The user has a specific LIFE EVENT. Analyze ONLY how that life event interacts with their finances. Output a JSON array of thinking_steps.

Each step has:
- "title": 3-5 word label directly referencing the life event
- "insights": array of {"text": "ONE punchy line with exact $ amounts", "type": "positive|negative|neutral"}

## STEP 0: DETECT INTENT (do this FIRST)
Read the life event carefully. Is the user:
- **PURSUING** something new → analyze the NEW goal
- **ABANDONING/PIVOTING** away from something → analyze the PIVOT, NOT the old goal
  - "done with buying a house" → user is LEAVING home buying. Analyze: where does FHSA money go? Tax implications of withdrawal. NOT: down payment gaps, mortgage rates.
  - "forget the business, I want to travel" → analyze TRAVEL, not business.
  - "cancel my RESP" → analyze what happens when RESP is closed, not education planning.
- **SIMPLE ACTION** ("move everything to chequing") → analyze the transfer impact. Don't overthink it.

## THE MOST IMPORTANT RULE
Every single step MUST be about the LIFE EVENT's ACTUAL INTENT. Ask yourself: "Would I show this step if the user had a DIFFERENT life event?" If yes → it's generic filler → DELETE IT.

BAD (generic profile audit — NEVER do this):
- "Cash Flow Analysis" — just restating income vs expenses
- "Current Liquid Position" — just summarizing balances
- "Emergency Buffer" — generic advice unrelated to the event
- "First-Time Buyer Opportunity" — unless the user is PURSUING home buying (not abandoning it!)
- "Immediate Action Required" — vague, not tied to the event
- "Home Purchase Impossible" — when the user said they're DONE with buying a house!

GOOD (life-event-focused — title names the EVENT, not the account):
- For "start a business": "Startup Runway" → "$30K liquid = 5.8mo at $5.2K burn"
- For "have a baby": "Parental Leave Drop" → "EI at $2,672/mo vs current $7.9K — $5.2K/mo gap"
- For "have a baby": "RESP Free Money" → "CESG matches 20% on $2,500/yr = $500/yr free"
- For "buy a house": "Down Payment Gap" → "Need $80K, have $45K — $35K short"
- For "pay off debt": "Interest Cost" → "$853 at 20% = $170/yr wasted"

RULES:
- 3-4 steps. EVERY step must directly address the life event.
- Title must reference the EVENT (e.g. "Parental Leave Drop", "Baby Budget"), NOT generic terms ("Cash Flow", "Liquid Position").
- Only mention accounts the user ACTUALLY HAS (balance > $0 or room > $0).
- Reference EXACT $ amounts from user data.
- NO generic financial health summaries. The user already sees their profile — don't repeat it back.
- Return ONLY valid JSON array. No markdown fences.

Example — life event "having a baby":
[
  {"title":"Parental Leave Drop","insights":[{"text":"EI at $2,672/mo vs $7.9K — $5.2K/mo income gap","type":"negative"}]},
  {"title":"RESP Free Money","insights":[{"text":"$2,500/yr gets $500 CESG match — start immediately","type":"positive"}]},
  {"title":"Baby Expense Buffer","insights":[{"text":"$1,200/mo childcare + $300 supplies = $1.5K new costs","type":"negative"}]}
]

Example — life event "quit my job and start a food truck":
[
  {"title":"Startup Runway","insights":[{"text":"$30K liquid covers ~5.8 months at $5.2K/mo","type":"positive"}]},
  {"title":"Income Gap","insights":[{"text":"Losing $95K salary — need revenue within 6mo","type":"negative"}]},
  {"title":"Business Costs","insights":[{"text":"Food truck + permits typically $50-80K startup","type":"neutral"}]}
]`;

export async function generateThinkingPreview(
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[] = [],
): Promise<ThinkingStep[]> {
  const userMessage = buildUserMessage(profile, lifeEvent, customFunds);

  const text = await callAI({
    system: THINKING_PREVIEW_PROMPT,
    userMessage,
    model: 'fast',
    temperature: 0.1,
    maxTokens: 2048,
  });
  try {
    const cleaned = stripMarkdownFences(text);
    const parsed = JSON.parse(cleaned);
    let steps: ThinkingStep[];
    if (Array.isArray(parsed)) {
      steps = parsed as ThinkingStep[];
    } else if (parsed.thinking_steps && Array.isArray(parsed.thinking_steps)) {
      steps = parsed.thinking_steps as ThinkingStep[];
    } else {
      throw new Error('Unexpected format');
    }

    // Remove steps about accounts the user doesn't actually have
    const emptyAccounts: string[] = [];
    if (profile.tfsaBalance === 0 && profile.tfsaRoom === 0) emptyAccounts.push('tfsa');
    if (profile.rrspBalance === 0 && profile.rrspRoom === 0) emptyAccounts.push('rrsp');
    if (profile.fhsaBalance === 0) emptyAccounts.push('fhsa');
    if (profile.nonRegBalance === 0) emptyAccounts.push('non-reg', 'non reg', 'nonreg');

    if (emptyAccounts.length > 0) {
      steps = steps.filter((step) => {
        const combined = (step.title + ' ' + step.insights.map(i => i.text).join(' ')).toLowerCase();
        for (const acct of emptyAccounts) {
          if (combined.includes(acct) && !combined.includes('open') && !combined.includes('consider')) {
            if (step.title.toLowerCase().includes(acct)) return false;
          }
        }
        return true;
      });
    }

    // Apply shared relevance filter (handles negation, generic steps, abandoned goals)
    steps = filterThinkingSteps(steps, lifeEvent);

    return steps;
  } catch {
    console.warn('[PreThink] Failed to parse:', text.slice(0, 300));
    const monthlyIncome = Math.round((profile.annualIncome + profile.partnerIncome) / 12);
    const monthlyCosts =
      profile.housingExpense +
      profile.essentialExpenses +
      profile.discretionarySpending +
      profile.debtPayments;
    const monthlyDelta = monthlyIncome - monthlyCosts;
    const liquidBalance = profile.chequingBalance + profile.savingsBalance;
    const runwayMonths = monthlyCosts > 0 ? liquidBalance / monthlyCosts : 0;
    const fallbackEvent = lifeEvent.trim().replace(/\s+/g, ' ').slice(0, 64);

    const formatCad = (amount: number) => `$${Math.round(amount).toLocaleString('en-CA')}`;
    const formatMonths = (months: number) => `${months.toFixed(1)} months`;

    return [
      {
        title: 'Cash Flow Snapshot',
        insights: [{
          text: `${formatCad(monthlyIncome)}/mo income vs ${formatCad(monthlyCosts)}/mo costs (${monthlyDelta >= 0 ? '+' : '-'}${formatCad(Math.abs(monthlyDelta))}/mo)`,
          type: monthlyDelta >= 0 ? 'positive' : 'negative',
        }],
      },
      {
        title: 'Liquidity Runway',
        insights: [{
          text: `${formatCad(liquidBalance)} liquid cash covers about ${formatMonths(runwayMonths)}`,
          type: runwayMonths >= 3 ? 'positive' : runwayMonths >= 1 ? 'neutral' : 'negative',
        }],
      },
      {
        title: 'Event Focus',
        insights: [{
          text: fallbackEvent.length > 0 ? `Planning next moves for: ${fallbackEvent}` : 'Planning next moves for your latest life update',
          type: 'neutral',
        }],
      },
    ];
  }
}

// ── Full orchestrator ────────────────────────────────────────────────────────

export async function runPathfinder(
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[] = [],
): Promise<PathfinderAPIResult> {
  const rules = getCanadianRuleSet();
  const systemPrompt = buildPathfinderSystemPrompt(new Date());
  const log: DebugLogEntry[] = [];
  const removedActions: string[] = [];

  // Step 1: Router (Claude Haiku → Gemini fallback)
  const route = await routeQuery(profile, lifeEvent, customFunds);
  console.info('[Pipeline] Router result:', JSON.stringify(route));
  log.push({
    step: 'Router',
    detail: route.needs_search
      ? `Search needed: ${route.queries.join(', ')}`
      : 'No search needed',
  });

  // Step 2: Search if needed (always Gemini for Google grounding)
  let searchContext: string | null = null;
  let searchMetadata: SearchMetadata | null = null;
  if (route.needs_search && route.queries.length > 0) {
    try {
      const searchResult = await searchForContext(route.queries);
      searchContext = searchResult.text;
      searchMetadata = searchResult.metadata;
      log.push({
        step: 'Search',
        detail: `Found ${searchResult.metadata.sources.length} sources`,
        data: searchContext.slice(0, 300),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Search] Failed:', msg);
      log.push({ step: 'Search', detail: `Search failed: ${msg}` });
    }
  }

  // Step 3: Generate the plan (Claude Sonnet → Gemini fallback)
  let userMessage = buildUserMessage(profile, lifeEvent, customFunds);
  if (searchContext) {
    userMessage += `\n\nRESEARCH_CONTEXT (current data from internet search — use these numbers where relevant):\n${searchContext}`;
  }

  const textContent = await callAI({
    system: systemPrompt,
    userMessage,
    model: 'main',
    temperature: 0.3,
    maxTokens: 16384,
  });

  if (!textContent) throw new Error('No text content in AI response');

  const rawResult = parsePathfinderResult(textContent);
  const actionsBeforeGuardrails = rawResult.quick_actions.length;

  log.push({
    step: 'Generate',
    detail: `AI produced ${actionsBeforeGuardrails} actions`,
    data: rawResult.quick_actions.map(a => a.title).join(' | '),
  });

  // Step 4: Guardrails
  const result = applyPostParseGuardrails(
    rawResult,
    profile,
    customFunds,
    lifeEvent,
    rules,
    removedActions,
  );

  if (removedActions.length > 0) {
    log.push({
      step: 'Guardrail',
      detail: `Removed ${removedActions.length}, kept ${result.quick_actions.length}`,
      data: removedActions.join(' | '),
    });
  }

  const debugLog: DebugLog = {
    entries: log,
    actionsBeforeGuardrails,
    actionsAfterGuardrails: result.quick_actions.length,
    removedActions,
  };

  return { result, searchMetadata, debugLog };
}

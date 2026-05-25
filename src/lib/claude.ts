import type { FinancialProfile, CustomFund, PathfinderResult, SearchMetadata, ThinkingStep, DebugLog } from './types';

export const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === 'true';

export interface PathfinderResponse {
  result: PathfinderResult;
  searchMetadata: SearchMetadata | null;
  debugLog: DebugLog | null;
}

export async function callPathfinder(
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[] = [],
): Promise<PathfinderResponse> {
  if (IS_STATIC_DEMO) {
    const { pickDemoScenario } = await import('./demo-data');
    const s = pickDemoScenario(lifeEvent);
    return { result: s.result, searchMetadata: s.searchMetadata, debugLog: s.debugLog };
  }

  const response = await fetch('/api/pathfinder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, lifeEvent, customFunds }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || `API error (${response.status})`);
  }

  return {
    result: data.result,
    searchMetadata: data.searchMetadata ?? null,
    debugLog: data.debugLog ?? null,
  };
}

export async function callPathfinderThink(
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[] = [],
): Promise<ThinkingStep[]> {
  if (IS_STATIC_DEMO) {
    const { pickDemoScenario } = await import('./demo-data');
    return pickDemoScenario(lifeEvent).result.thinking_steps;
  }

  const response = await fetch('/api/pathfinder/think', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, lifeEvent, customFunds }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || `Think API error (${response.status})`);
  }

  return data.thinking_steps ?? [];
}

// ── Streaming API ──────────────────────────────────────────────────────────

export interface StreamStepEvent {
  type: 'step';
  id: string;
  status: 'active' | 'complete';
  label: string;
  detail?: string;
}

export interface StreamThinkingEvent {
  type: 'thinking_steps';
  steps: ThinkingStep[];
}

export interface StreamCompleteEvent {
  type: 'complete';
  result: PathfinderResult;
  searchMetadata: SearchMetadata | null;
  debugLog: DebugLog | null;
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
}

export type StreamEvent = StreamStepEvent | StreamThinkingEvent | StreamCompleteEvent | StreamErrorEvent;

export async function callPathfinderStream(
  profile: FinancialProfile,
  lifeEvent: string,
  customFunds: CustomFund[] = [],
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  if (IS_STATIC_DEMO) {
    const { runDemoStream } = await import('./demo-data');
    await runDemoStream(lifeEvent, onEvent);
    return;
  }

  const response = await fetch('/api/pathfinder/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, lifeEvent, customFunds }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Stream error (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          onEvent(data as StreamEvent);
        } catch {
          // Skip malformed events
        }
      }
    }
  }
}

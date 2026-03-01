import type { FinancialProfile, CustomFund, PathfinderResult, SearchMetadata, ThinkingStep, DebugLog } from './types';

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

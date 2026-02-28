import type { FinancialProfile, CustomFund, PathfinderResult, SearchMetadata } from './types';

export interface PathfinderResponse {
  result: PathfinderResult;
  searchMetadata: SearchMetadata | null;
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
  };
}

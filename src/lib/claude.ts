import type { FinancialProfile, PathfinderResult } from './types';

export interface PathfinderResponse {
  result: PathfinderResult;
  error?: string;
}

export async function callPathfinder(
  profile: FinancialProfile,
  lifeEvent: string,
): Promise<PathfinderResult> {
  const response = await fetch('/api/pathfinder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, lifeEvent }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || `API error (${response.status})`);
  }

  return data.result;
}

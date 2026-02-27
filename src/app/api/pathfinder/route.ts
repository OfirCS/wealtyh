import { NextRequest, NextResponse } from 'next/server';
import { runPathfinder } from '@/lib/pathfinder-engine';
import type { FinancialProfile } from '@/lib/types';

interface PathfinderRequestBody {
  profile: FinancialProfile;
  lifeEvent: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PathfinderRequestBody = await request.json();

    if (!body.profile || !body.lifeEvent) {
      return NextResponse.json(
        { error: 'Missing required fields: profile and lifeEvent' },
        { status: 400 },
      );
    }

    const { result, searchMetadata } = await runPathfinder(body.profile, body.lifeEvent);
    return NextResponse.json({ result, searchMetadata });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    console.error('[Pathfinder API] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

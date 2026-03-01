import { NextResponse } from 'next/server';
import { generateThinkingPreview } from '@/lib/pathfinder-engine';
import type { FinancialProfile, CustomFund } from '@/lib/types';

interface ThinkRequestBody {
  profile: FinancialProfile;
  lifeEvent: string;
  customFunds?: CustomFund[];
}

export async function POST(request: Request) {
  try {
    const body: ThinkRequestBody = await request.json();

    if (!body.profile || !body.lifeEvent) {
      return NextResponse.json(
        { error: 'Missing required fields: profile, lifeEvent' },
        { status: 400 },
      );
    }

    const thinking_steps = await generateThinkingPreview(
      body.profile,
      body.lifeEvent,
      body.customFunds ?? [],
    );

    return NextResponse.json({ thinking_steps });
  } catch (err) {
    console.error('[Think API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Pre-think failed' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

function buildImagePrompt(lifeEvent: string): string {
  const lower = lifeEvent.toLowerCase();
  const isHome = /home|house|condo|mortgage|property/.test(lower);
  const isFamily = /baby|child|parent|family|education|school/.test(lower);
  const isBusiness = /business|startup|freelance|self-employed|company/.test(lower);
  const isCareer = /job|career|leave|quit|income/.test(lower);

  const palette = isHome
    ? 'sand, terracotta, muted green'
    : isFamily
      ? 'warm cream, sage, soft coral'
      : isBusiness
        ? 'graphite, teal, copper'
        : isCareer
          ? 'forest green, charcoal, warm beige'
          : 'sand, gold, forest green';

  const motif = isHome
    ? 'layered geometric rooftops and horizon lines'
    : isFamily
      ? 'interlocking circles and protective curved forms'
      : isBusiness
        ? 'upward modular blocks and directional pathways'
        : isCareer
          ? 'branching paths converging into one route'
          : 'clean geometric pathways with calm balance';

  return `Minimalist abstract illustration about "${lifeEvent}".
Palette: ${palette}.
Motif: ${motif}.
No text, no logos, no people, no faces.
Wealthsimple-like aesthetic: clean, calming, modern.
High quality digital art, 1:1 aspect ratio.`;
}

export async function POST(request: NextRequest) {
  try {
    const { lifeEvent } = await request.json();

    if (!lifeEvent) {
      return NextResponse.json({ error: 'Missing lifeEvent' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const imagePrompt = buildImagePrompt(lifeEvent);

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
      },
    });

    const image = response.generatedImages?.[0]?.image?.imageBytes;
    if (!image) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    return NextResponse.json({ imageBase64: image });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image generation failed';
    console.error('[Image Gen] Error:', message);
    // Return gracefully - image gen is optional
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

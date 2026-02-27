import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

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

    // Build a prompt for a warm, abstract financial illustration
    const imagePrompt = `Minimalist, warm-toned abstract illustration representing "${lifeEvent}". Soft gradients in sand, gold, and forest green tones. Clean geometric shapes, no text, no people, no faces. Wealthsimple brand aesthetic - simple, calming, modern. High quality digital art, 1:1 aspect ratio.`;

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

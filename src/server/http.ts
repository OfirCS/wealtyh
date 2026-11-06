import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, 'unauthorized', 'Sign in first.');
export const notFound = () => new ApiError(404, 'not_found', 'Not found.');

function problem(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: { code: 'bad_request', message: 'That request looks wrong.' } }, { status: 400 });
  }
  // Only the name: messages from a provider can carry account details
  console.error('[api] failed', error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({ error: { code: 'server_error', message: 'Something went wrong. Try again.' } }, { status: 500 });
}

/** A cookie is sent by any site that posts here, so a browser's write must come from this site. */
function checkOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin');
  if (!origin || request.method === 'GET' || request.headers.get('authorization')?.startsWith('Bearer ')) return;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (new URL(origin).host !== host) throw new ApiError(403, 'forbidden', 'Not from this site.');
}

type Handler<Params> = (request: NextRequest, context: { params: Promise<Params> }) => Promise<Response | object>;

/** Every route goes through this, so errors have one shape and nothing leaks. */
export function route<Params = Record<string, never>>(handler: Handler<Params>) {
  return async (request: NextRequest, context: { params: Promise<Params> }): Promise<Response> => {
    try {
      checkOrigin(request);
      const result = await handler(request, context);
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (error) {
      return problem(error);
    }
  };
}

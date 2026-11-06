import { z } from 'zod';
import { requireHousehold } from '@/server/auth/session';
import { startCheckout } from '@/server/billing';
import { route } from '@/server/http';

const body = z.object({ yearly: z.boolean().default(false) });

export const POST = route(async (request) => {
  const household = await requireHousehold(request);
  const { yearly } = body.parse(await request.json().catch(() => ({})));
  return { url: await startCheckout(household, yearly, request.nextUrl.origin) };
});

import { requireHousehold } from '@/server/auth/session';
import { openPortal } from '@/server/billing';
import { route } from '@/server/http';

export const POST = route(async (request) => {
  const household = await requireHousehold(request);
  return { url: await openPortal(household, request.nextUrl.origin) };
});

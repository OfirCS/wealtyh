import { requireHousehold } from '@/server/auth/session';
import { ApiError, route } from '@/server/http';
import { takeToken } from '@/server/rate-limit';
import { syncHousehold } from '@/server/sync';

/** Polling a new connection uses a few. Anything near this is a script. */
const FORCED_SYNCS_A_DAY = 300;

export const POST = route(async (request) => {
  const household = await requireHousehold(request);
  const force = request.nextUrl.searchParams.has('force');
  if (force && !await takeToken(`sync:${household}`, FORCED_SYNCS_A_DAY)) throw new ApiError(429, 'too_many', 'Try again later.');
  return { results: await syncHousehold(household, force) };
});

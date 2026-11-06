import { timingSafeEqual } from 'crypto';
import { env } from '@/server/env';
import { unauthorized, route } from '@/server/http';
import { syncEverything } from '@/server/sync';

function allowed(header: string | null): boolean {
  const secret = env().CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** A daily safety net for any webhook that went missing. */
export const GET = route(async (request) => {
  if (!allowed(request.headers.get('authorization'))) throw unauthorized();
  return { synced: await syncEverything() };
});

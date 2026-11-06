import { z } from 'zod';
import { requireHousehold } from '@/server/auth/session';
import { route } from '@/server/http';
import { readSightings } from '@/server/sightings';

const query = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().positive().optional(),
});

export const GET = route(async (request) => {
  const household = await requireHousehold(request);
  const { after, limit } = query.parse(Object.fromEntries(request.nextUrl.searchParams));
  return readSightings(household, after, limit);
});

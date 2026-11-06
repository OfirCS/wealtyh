import { requireHousehold } from '@/server/auth/session';
import { env } from '@/server/env';
import { route } from '@/server/http';
import { mintTapToken } from '@/server/wallet';

export const POST = route(async (request) => {
  const household = await requireHousehold(request);
  const token = await mintTapToken(household);
  const url = `${env().PUBLIC_URL ?? request.nextUrl.origin}/api/v1/wallet/tap`;
  return { token, url, link: `${url}?key=${token}` };
});

import { handleStripeEvent } from '@/server/billing';
import { route } from '@/server/http';

export const POST = route(async (request) => {
  await handleStripeEvent(await request.text(), request.headers.get('stripe-signature'));
  return { ok: true };
});

import { count, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { canAddBank, PLANS, planFor } from '@/core/plans';
import type { Plan } from '@/core/plans';
import { getDb, schema } from './db';
import { env } from './env';
import { ApiError } from './http';

const { connections, households } = schema;

export function billingOn(): boolean {
  const { STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, STRIPE_WEBHOOK_SECRET } = env();
  return Boolean(STRIPE_SECRET_KEY && STRIPE_PRICE_MONTHLY && STRIPE_PRICE_YEARLY && STRIPE_WEBHOOK_SECRET);
}

function stripe(): Stripe {
  const { STRIPE_SECRET_KEY } = env();
  if (!STRIPE_SECRET_KEY) throw new ApiError(503, 'no_billing', 'Plans are not open yet.');
  return new Stripe(STRIPE_SECRET_KEY);
}

/** Until billing is switched on, everyone gets everything. */
export async function planOf(householdId: string): Promise<Plan> {
  if (!billingOn()) return PLANS.family;
  const db = await getDb();
  const [household] = await db.select({ plan: households.plan }).from(households).where(eq(households.id, householdId));
  return planFor(household?.plan);
}

export async function requireBankRoom(householdId: string): Promise<void> {
  const db = await getDb();
  const [{ value }] = await db.select({ value: count() }).from(connections).where(eq(connections.householdId, householdId));
  if (!canAddBank(await planOf(householdId), value)) throw new ApiError(402, 'upgrade', 'Bank logins come with Family.');
}

export async function startCheckout(householdId: string, yearly: boolean, origin: string): Promise<string> {
  const { STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, PUBLIC_URL } = env();
  const base = PUBLIC_URL ?? origin;
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: householdId,
    line_items: [{ price: yearly ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY, quantity: 1 }],
    success_url: `${base}/?plan=family`,
    cancel_url: `${base}/`,
  });
  if (!session.url) throw new ApiError(502, 'no_checkout', "Checkout didn't open. Try again.");
  return session.url;
}

export async function openPortal(householdId: string, origin: string): Promise<string> {
  const db = await getDb();
  const [household] = await db.select({ customer: households.stripeCustomer }).from(households).where(eq(households.id, householdId));
  if (!household?.customer) throw new ApiError(404, 'no_plan', 'No plan to manage.');
  const { url } = await stripe().billingPortal.sessions.create({ customer: household.customer, return_url: env().PUBLIC_URL ?? origin });
  return url;
}

async function setPlan(where: ReturnType<typeof eq>, plan: Plan['id'], customer?: string): Promise<void> {
  const db = await getDb();
  await db.update(households).set({ plan, ...(customer ? { stripeCustomer: customer } : {}) }).where(where);
}

/** Stripe signs what it sends, so nobody can post a fake payment here. */
export async function handleStripeEvent(body: string, signature: string | null): Promise<void> {
  const { STRIPE_WEBHOOK_SECRET } = env();
  if (!signature || !STRIPE_WEBHOOK_SECRET) throw new ApiError(401, 'unauthorized', 'Not signed.');
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new ApiError(401, 'unauthorized', 'Not signed.');
  }

  if (event.type === 'checkout.session.completed') {
    const { client_reference_id: householdId, customer } = event.data.object;
    if (householdId) await setPlan(eq(households.id, householdId), 'family', typeof customer === 'string' ? customer : customer?.id);
  }
  if (event.type === 'customer.subscription.deleted') {
    const { customer } = event.data.object;
    await setPlan(eq(households.stripeCustomer, typeof customer === 'string' ? customer : customer.id), 'free');
  }
}

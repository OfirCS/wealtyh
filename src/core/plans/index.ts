// What each plan includes. Free covers everything that doesn't cost money per family.

export type PlanId = 'free' | 'family';

export interface Plan {
  id: PlanId;
  name: string;
  /** Canadian cents. */
  monthlyCents: number;
  yearlyCents: number;
  bankLogins: number;
  inboxes: number;
  asksADay: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: 'free', name: 'Free', monthlyCents: 0, yearlyCents: 0, bankLogins: 0, inboxes: 1, asksADay: 5 },
  family: { id: 'family', name: 'Family', monthlyCents: 799, yearlyCents: 6900, bankLogins: 5, inboxes: 4, asksADay: 50 },
};

export function planFor(id: string | null | undefined): Plan {
  return id === 'family' ? PLANS.family : PLANS.free;
}

export function canAddBank(plan: Plan, connected: number): boolean {
  return connected < plan.bankLogins;
}

export function canAddInbox(plan: Plan, connected: number): boolean {
  return connected < plan.inboxes;
}

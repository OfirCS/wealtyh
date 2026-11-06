// Banks and Wallet keep moving while nobody's looking, so this looks for them once a day.
// A webhook usually gets there first, and this catches anything that went missing.
export default async function dailyCheck(): Promise<void> {
  const { PUBLIC_URL, CRON_SECRET } = process.env;
  const response = await fetch(`${PUBLIC_URL}/api/v1/cron/sync`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
  console.info('[daily-check]', response.status);
}

export const config = { schedule: '@daily' };

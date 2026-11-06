// What brings someone back. Every reason here comes from their own money, so it
// reads as useful rather than as a nag: something new to see today, a real reason
// to look tomorrow, and a reminder in a calendar they already trust.

import { deadlineTitle, monthlyRenewals, tidyName, upcomingBills, upcomingDeadlines } from './agent-insights';
import { categoryName, countsAsSpending, merchantKey } from './budget';
import type { Budget } from './budget';
import { formatMoney } from './money';
import { addDays, readStreak } from './streak';

const DAYS_PER_SHIELD = 7;
const DAYS_TO_WARN_AHEAD = 7;
const SMALL_PURCHASE = 20;
const MONTHS_A_YEAR = 12;
const CHECK_IN_TIME = 'T193000';

function shortDate(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

/** Everything that has come back so far. It's the number that grows the longer you stay. */
export function moneyBack(budget: Budget): number {
  return budget.transactions
    .filter((item) => countsAsSpending(item) && item.amount < 0)
    .reduce((sum, item) => sum - item.amount, 0);
}

/** Pulls one surprise from the real numbers, different from day to day. */
export function dailyFind(budget: Budget, today: string): string | null {
  const spending = budget.transactions.filter(countsAsSpending);
  if (spending.length === 0) return null;
  const finds: string[] = [];

  const refunds = spending.filter((item) => item.amount < 0).reduce((sum, item) => sum - item.amount, 0);
  if (refunds > 0) finds.push(`You've had ${formatMoney(refunds)} back in refunds so far.`);

  const renewing = monthlyRenewals(upcomingBills(budget, today));
  if (renewing > 0) finds.push(`What renews by itself costs ${formatMoney(renewing * MONTHS_A_YEAR)} a year.`);

  const visits = new Map<string, { name: string; count: number }>();
  for (const item of spending) {
    if (item.amount <= 0) continue;
    const key = merchantKey(item.description);
    visits.set(key, { name: tidyName(item.description), count: (visits.get(key)?.count ?? 0) + 1 });
  }
  const regular = [...visits.values()].sort((a, b) => b.count - a.count)[0];
  if (regular && regular.count >= 3) finds.push(`${regular.name} is your regular: ${regular.count} purchases so far.`);

  const small = spending.filter((item) => item.amount > 0 && item.amount < SMALL_PURCHASE);
  if (small.length >= 5) finds.push(`Small stuff adds up: ${small.length} purchases under ${formatMoney(SMALL_PURCHASE)} came to ${formatMoney(small.reduce((sum, item) => sum + item.amount, 0))}.`);

  const byWeekday = new Map<string, number>();
  for (const item of spending) {
    if (item.amount <= 0) continue;
    const weekday = new Date(`${item.date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long' });
    byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + item.amount);
  }
  const busiest = [...byWeekday.entries()].sort((a, b) => b[1] - a[1])[0];
  if (busiest && byWeekday.size >= 3) finds.push(`${busiest[0]}s are your biggest spending day.`);

  const thisMonth = today.slice(0, 7);
  const lastMonth = addDays(`${thisMonth}-01`, -1).slice(0, 7);
  const change = new Map<string, number>();
  for (const item of spending) {
    if (item.date.startsWith(lastMonth)) change.set(item.categoryId, (change.get(item.categoryId) ?? 0) + item.amount);
    if (item.date.startsWith(thisMonth)) change.set(item.categoryId, (change.get(item.categoryId) ?? 0) - item.amount);
  }
  const improved = [...change.entries()].sort((a, b) => b[1] - a[1])[0];
  if (Number(today.slice(8, 10)) >= 20 && improved && improved[1] > 0) finds.push(`${categoryName(improved[0])} is down ${formatMoney(improved[1])} from last month.`);

  return finds.length > 0 ? finds[dayNumber(today) % finds.length] : null;
}

/** Ends every check-in with a reason to return that's already true. */
export function tomorrowLine(budget: Budget, today: string): string {
  const tomorrow = addDays(today, 1);
  const closing = upcomingDeadlines(budget, today).find((deadline) => deadline.date === tomorrow);
  if (closing) return `Tomorrow: ${deadlineTitle(closing)}.`;

  const renewals = upcomingBills(budget, today).filter((bill) => bill.stated);
  const dueTomorrow = renewals.find((bill) => bill.date === tomorrow);
  if (dueTomorrow) return `Tomorrow: ${dueTomorrow.name} renews for ${formatMoney(dueTomorrow.amount)}.`;

  const nextDay = readStreak(budget.checkIns, today).days + 1;
  if (nextDay % DAYS_PER_SHIELD === 0) return `Tomorrow: day ${nextDay} earns you a shield.`;

  const soon = renewals.find((bill) => bill.date <= addDays(today, DAYS_TO_WARN_AHEAD));
  if (soon) return `${soon.name} renews on ${shortDate(soon.date)}. I'll have it ready for you.`;
  return `Tomorrow: day ${nextDay}, and a new find.`;
}

function icsText(text: string): string {
  return text.replace(/([,;\\])/g, '\\$1');
}

/** Reminders that work today with no server: a nightly check-in and each known renewal. */
export function calendarFile(budget: Budget, today: string, appUrl: string): string {
  const stamp = `${today.replaceAll('-', '')}T120000Z`;
  const tomorrow = addDays(today, 1).replaceAll('-', '');
  const event = (id: string, lines: string[]) => ['BEGIN:VEVENT', `UID:${id}@pathfinder`, `DTSTAMP:${stamp}`, ...lines, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', 'DESCRIPTION:Pathfinder', 'END:VALARM', 'END:VEVENT'];

  const renewals = upcomingBills(budget, today)
    .filter((bill) => bill.stated)
    .flatMap((bill) => {
      const warning = addDays(bill.date, -1).replaceAll('-', '');
      return event(`renews-${merchantKey(bill.name).replace(/\s/g, '-')}-${bill.date}`, [
        `DTSTART:${warning}T090000`,
        'DURATION:PT10M',
        `SUMMARY:${icsText(`${bill.name} renews tomorrow: ${formatMoney(bill.amount)}`)}`,
        `DESCRIPTION:${icsText('Still worth it? Check in before it charges.')}`,
        `URL:${appUrl}`,
      ]);
    });

  const deadlines = upcomingDeadlines(budget, today).flatMap((deadline) => event(`${deadline.kind}-${merchantKey(deadline.what).replace(/\s/g, '-')}-${deadline.date}`, [
    `DTSTART:${addDays(deadline.date, -1).replaceAll('-', '')}T090000`,
    'DURATION:PT10M',
    `SUMMARY:${icsText(`${deadlineTitle(deadline)} by tomorrow`)}`,
    `URL:${appUrl}`,
  ]));

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pathfinder//Reminders//EN',
    ...event('daily-check-in', [
      `DTSTART:${tomorrow}${CHECK_IN_TIME}`,
      'DURATION:PT5M',
      'RRULE:FREQ=DAILY',
      'SUMMARY:Check in on Pathfinder',
      `DESCRIPTION:${icsText('One click. See how today went and keep your streak.')}`,
      `URL:${appUrl}`,
    ]),
    ...renewals,
    ...deadlines,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadCalendar(contents: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([contents], { type: 'text/calendar' }));
  link.download = 'pathfinder-reminders.ics';
  link.click();
  URL.revokeObjectURL(link.href);
}

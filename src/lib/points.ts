// A reason to open a budget app on a good day. Points reward the habits that keep a family's
// money healthy: looking, staying under, beating the week's goal. A bad day never takes any
// away, because the day someone overspends is the day they most need to keep looking.

import { countsAsSpending, purchaseRhythms } from './budget';
import type { Budget } from './budget';
import { formatMoney } from './money';
import { addDays, readPace, readStreak, recordCheckIn } from './streak';
import type { Streak } from './streak';

export interface PointEntry {
  /** Stops anything being awarded twice. */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  label: string;
  points: number;
}

const CHECK_IN_POINTS = 10;
const UNDER_PACE_POINTS = 25;
export const FULL_CARD_POINTS = 100;
const WEEK_GOAL_POINTS = 100;
const CONNECTED_POINTS = 100;
/** A streak is a punch card: one spot a day, and the last spot pays out. */
export const CARD_SPOTS = 7;

export const EARNING = [
  { label: 'Check in', points: CHECK_IN_POINTS, per: 'a day' },
  { label: 'Stay under pace', points: UNDER_PACE_POINTS, per: 'a day' },
  { label: "Beat the week's goal", points: WEEK_GOAL_POINTS, per: 'a week' },
  { label: 'Fill a 7-day card', points: FULL_CARD_POINTS, per: 'each time' },
  { label: 'Connect an account', points: CONNECTED_POINTS, per: 'once' },
];

const LEVELS = [
  { name: 'Starter', from: 0 },
  { name: 'Steady', from: 500 },
  { name: 'Sharp', from: 1500 },
  { name: 'Seasoned', from: 4000 },
  { name: 'Steward', from: 10_000 },
];

const ENTRIES_KEPT = 300;

export interface PointsSummary {
  total: number;
  level: number;
  name: string;
  /** The next level, unless they've reached the top. */
  next: { name: string; toGo: number } | null;
  /** How far through this level, from 0 to 1. */
  share: number;
  recent: PointEntry[];
}

export function readPoints(budget: Pick<Budget, 'points' | 'pointsEarlier'> | null): PointsSummary {
  const entries = budget?.points ?? [];
  const total = (budget?.pointsEarlier ?? 0) + entries.reduce((sum, entry) => sum + entry.points, 0);
  const index = LEVELS.findLastIndex((level) => total >= level.from);
  const next = LEVELS[index + 1];
  return {
    total,
    level: index + 1,
    name: LEVELS[index].name,
    next: next ? { name: next.name, toGo: next.from - total } : null,
    share: next ? (total - LEVELS[index].from) / (next.from - LEVELS[index].from) : 1,
    recent: [...entries].reverse(),
  };
}

function award(budget: Budget, entry: PointEntry): Budget {
  if (budget.points?.some((item) => item.id === entry.id)) return budget;
  const points = [...(budget.points ?? []), entry];
  const dropped = points.slice(0, Math.max(0, points.length - ENTRIES_KEPT));
  return {
    ...budget,
    points: points.slice(dropped.length),
    ...(dropped.length > 0 ? { pointsEarlier: (budget.pointsEarlier ?? 0) + dropped.reduce((sum, item) => sum + item.points, 0) } : {}),
  };
}

/** The Monday a day belongs to. */
function weekOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

const WEEK_DAYS = 7;
const WEEKS_LOOKED_AT = 8;
const GOAL_CATEGORIES: Record<string, string> = { eating: 'eating out', shopping: 'shopping', fun: 'fun', transport: 'getting around', groceries: 'groceries' };
const WORTH_A_GOAL = 15;
const TIGHTER_BY = 0.85;
const ROUND_TO = 5;
const GOALS_TO_ROTATE = 3;
/** One big order isn't a habit, and a goal needs a habit behind it. */
const WEEKS_FOR_A_HABIT = 3;
const CHECK_IN_GOAL = 5;

export interface WeekGoal {
  id: string;
  /** Where the money goes, or null for a goal about showing up. */
  categoryId: string | null;
  title: string;
  target: number;
  reward: number;
}

function spentInWeek(budget: Budget, categoryId: string, week: string): number {
  const end = addDays(week, WEEK_DAYS);
  const rhythms = purchaseRhythms(budget);
  return budget.transactions
    .filter((item) => item.categoryId === categoryId && item.date >= week && item.date < end && countsAsSpending(item) && rhythms.get(item.id) === 'everyday')
    .reduce((sum, item) => sum + item.amount, 0);
}

function middleOf(amounts: number[]): number {
  const sorted = [...amounts].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * One goal for the week, set from the family's own habits: a little tighter than a normal week,
 * in something they do most weeks. Only history from before the week counts, so it can't move.
 */
export function weekGoal(budget: Budget, week: string): WeekGoal {
  const usual = Object.keys(GOAL_CATEGORIES)
    .map((categoryId) => {
      const weeks = Array.from({ length: WEEKS_LOOKED_AT }, (_, index) => spentInWeek(budget, categoryId, addDays(week, -(index + 1) * WEEK_DAYS)));
      const active = weeks.filter((amount) => amount > 0);
      return { categoryId, weeksActive: active.length, weekly: active.length >= WEEKS_FOR_A_HABIT ? middleOf(active) : 0 };
    })
    .filter((item) => item.weekly >= WORTH_A_GOAL)
    .sort((a, b) => b.weeksActive - a.weeksActive || b.weekly - a.weekly)
    .slice(0, GOALS_TO_ROTATE);

  if (usual.length === 0) {
    return { id: `goal:${week}`, categoryId: null, title: `Check in ${CHECK_IN_GOAL} days`, target: CHECK_IN_GOAL, reward: WEEK_GOAL_POINTS };
  }
  const weekNumber = Math.floor(Date.parse(`${week}T00:00:00Z`) / (WEEK_DAYS * 86_400_000));
  const pick = usual[weekNumber % usual.length];
  const target = Math.max(ROUND_TO, Math.floor((pick.weekly * TIGHTER_BY) / ROUND_TO) * ROUND_TO);
  const name = GOAL_CATEGORIES[pick.categoryId];
  return { id: `goal:${week}`, categoryId: pick.categoryId, title: `${name[0].toUpperCase()}${name.slice(1)} under ${formatMoney(target)}`, target, reward: WEEK_GOAL_POINTS };
}

function checkInsInWeek(budget: Budget, week: string): number {
  const end = addDays(week, WEEK_DAYS);
  return (budget.checkIns ?? []).filter((day) => day >= week && day < end).length;
}

export interface GoalProgress extends WeekGoal {
  /** Dollars spent, or days checked in. */
  done: number;
  /** How much of the goal is used up, from 0 to 1. */
  share: number;
  /** Where it stands, in a couple of words. */
  short: string;
  /** Past the target, so this week's game is lost. */
  over: boolean;
  detail: string;
  /** When there's a new game, for when this one is lost. */
  next: string;
}

export function readGoal(budget: Budget, today: string): GoalProgress {
  const week = weekOf(today);
  const goal = weekGoal(budget, week);
  const daysLeft = WEEK_DAYS - Math.round((Date.parse(today) - Date.parse(week)) / 86_400_000);
  const left = daysLeft === 1 ? 'Last day' : `${daysLeft} days left`;
  const next = daysLeft === 1 ? 'New goal tomorrow' : 'New goal Monday';
  if (!goal.categoryId) {
    const done = checkInsInWeek(budget, week);
    const share = Math.min(1, done / goal.target);
    return { ...goal, done, share, short: `${done} of ${goal.target}`, over: false, detail: `${done} of ${goal.target} · ${left}`, next };
  }
  const done = spentInWeek(budget, goal.categoryId, week);
  const share = Math.min(1, done / goal.target);
  return { ...goal, done, share, short: `${formatMoney(Math.max(0, goal.target - done))} left`, over: done > goal.target, detail: `${formatMoney(done)} of ${formatMoney(goal.target)} · ${left}`, next };
}

/** How many spots are punched. A full card pays out, and tomorrow starts a fresh one. */
export function punchesOnCard({ days, checkedInToday }: Pick<Streak, 'days' | 'checkedInToday'>): number {
  return checkedInToday ? ((days - 1) % CARD_SPOTS) + 1 : days % CARD_SPOTS;
}

function wonLastWeek(budget: Budget, today: string): WeekGoal | null {
  const week = addDays(weekOf(today), -WEEK_DAYS);
  // Nobody wins a game they weren't playing
  if (checkInsInWeek(budget, week) === 0) return null;
  const goal = weekGoal(budget, week);
  const beaten = goal.categoryId ? spentInWeek(budget, goal.categoryId, week) <= goal.target : checkInsInWeek(budget, week) >= goal.target;
  return beaten ? goal : null;
}

/** Everything a check-in earns. Each award has an id, so doing this twice changes nothing. */
export function checkIn(budget: Budget, today: string): Budget {
  const pace = budget.categories.length > 0 ? readPace(budget, today) : null;
  let next = recordCheckIn(budget, today);
  const add = (id: string, label: string, points: number) => { next = award(next, { id, date: today, label, points }); };

  add(`day:${today}`, 'Checked in', CHECK_IN_POINTS);
  if (pace && pace.yesterday >= 0) add(`under:${today}`, 'Stayed under pace yesterday', UNDER_PACE_POINTS);

  const { days } = readStreak(next.checkIns, today);
  if (days > 0 && days % CARD_SPOTS === 0) add(`streak:${today}`, `${days}-day streak`, FULL_CARD_POINTS);

  const sources = new Set(budget.transactions.map((transaction) => transaction.source));
  if (sources.has('mail')) add('connected:gmail', 'Connected Gmail', CONNECTED_POINTS);
  if (sources.has('bank')) add('connected:bank', 'Connected your bank', CONNECTED_POINTS);
  if (sources.has('wallet')) add('connected:wallet', 'Connected Apple Wallet', CONNECTED_POINTS);

  const won = wonLastWeek(budget, today);
  if (won) add(won.id, `Beat the goal: ${won.title}`, won.reward);
  return next;
}

/** What today has earned so far. */
export function pointsToday(budget: Budget | null, today: string): number {
  return (budget?.points ?? []).filter((entry) => entry.date === today).reduce((sum, entry) => sum + entry.points, 0);
}

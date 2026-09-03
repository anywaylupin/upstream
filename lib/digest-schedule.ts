/**
 * Digest scheduling: the shape of a schedule, and the date maths that decides
 * when one is due.
 *
 * Deliberately free of any `db` import so the settings form (a client
 * component) can share these constants. Importing a value out of a
 * `"use client"` module into a server component yields a client-reference
 * proxy, not the value, so shared constants have to live in a plain module
 * like this one.
 */

export const DIGEST_FREQUENCIES = [
  { id: 'daily', label: 'Daily', hint: 'Every day' },
  { id: 'weekly', label: 'Weekly', hint: 'One day a week' },
  { id: 'biweekly', label: 'Biweekly', hint: 'Same day, every other week' },
  { id: 'monthly', label: 'Monthly', hint: 'One date each month' },
  { id: 'custom', label: 'Custom', hint: 'A gap you choose' }
] as const;

export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number]['id'];

const FREQUENCY_IDS = DIGEST_FREQUENCIES.map((frequency) => frequency.id);

export function isDigestFrequency(value: unknown): value is DigestFrequency {
  return typeof value === 'string' && (FREQUENCY_IDS as readonly string[]).includes(value);
}

/** `initial` drives the day chips. Two S's and two T's, so never show it alone. */
export const WEEKDAYS = [
  { value: 0, label: 'Sunday', short: 'Sun', initial: 'S' },
  { value: 1, label: 'Monday', short: 'Mon', initial: 'M' },
  { value: 2, label: 'Tuesday', short: 'Tue', initial: 'T' },
  { value: 3, label: 'Wednesday', short: 'Wed', initial: 'W' },
  { value: 4, label: 'Thursday', short: 'Thu', initial: 'T' },
  { value: 5, label: 'Friday', short: 'Fri', initial: 'F' },
  { value: 6, label: 'Saturday', short: 'Sat', initial: 'S' }
] as const;

/**
 * Capped at 28 so every month actually has the date. Allowing 29-31 would mean
 * silently skipping February, which is worse than not offering it.
 */
export const MAX_DAY_OF_MONTH = 28;

export const MIN_INTERVAL_DAYS = 2;
export const MAX_INTERVAL_DAYS = 90;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type DigestSchedule = {
  enabled: boolean;
  frequency: DigestFrequency;
  hour: number;
  weekday: number;
  timezone: string;
  dayOfMonth: number;
  intervalDays: number;
  lastDigestAt: Date | null;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  const cached = formatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock fields of `at` as seen in `timeZone`. */
export function zonedParts(at: Date, timeZone: string) {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = formatterFor(zone).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);

  const year = read('year');
  const month = read('month');
  const day = read('day');
  const hour = read('hour') % 24;
  const minute = read('minute');

  // Derived rather than parsed from a localized weekday string, which varies.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return { year, month, day, hour, minute, weekday };
}

/**
 * The instant at which `timeZone` reads the given wall-clock time. Guess in UTC,
 * measure how far the zone's rendering of that guess misses the target, correct.
 * Twice, because a correction can itself cross a DST boundary.
 *
 * The error is measured against the target, never against the running guess -
 * against the guess it would keep re-subtracting the zone's UTC offset and the
 * second pass would undo the first.
 */
export function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number },
  timeZone: string
): Date {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour);
  let stamp = target;

  for (let pass = 0; pass < 2; pass += 1) {
    const seen = zonedParts(new Date(stamp), timeZone);
    // To the minute, or zones offset by :30 and :45 land half an hour late.
    const error = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute) - target;
    if (error === 0) break;
    stamp -= error;
  }

  return new Date(stamp);
}

/**
 * Vercel Cron is a project-level schedule and cannot fire per user, so it ticks
 * hourly and this decides whose digest is due. That is what makes a per-user
 * schedule possible at all.
 *
 * `biweekly` and `custom` need no anchor column: the weekday pins the day and
 * the gap since `lastDigestAt` pins the week.
 */
export function isDigestDue(schedule: DigestSchedule, now = new Date()) {
  if (!schedule.enabled) return false;

  const here = zonedParts(now, schedule.timezone);
  if (here.hour !== schedule.hour) return false;

  const elapsed = schedule.lastDigestAt ? now.getTime() - schedule.lastDigestAt.getTime() : Number.POSITIVE_INFINITY;

  // Never twice in the same hour, however often the cron runs.
  if (elapsed < HOUR_MS) return false;

  switch (schedule.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return here.weekday === schedule.weekday;
    case 'biweekly':
      return here.weekday === schedule.weekday && elapsed >= 13 * DAY_MS;
    case 'monthly':
      return here.day === Math.min(schedule.dayOfMonth, MAX_DAY_OF_MONTH);
    case 'custom':
      return elapsed >= schedule.intervalDays * DAY_MS;
    default:
      return false;
  }
}

/**
 * When the next digest would go out, for display in settings. Walks candidate
 * instants and reuses `isDigestDue`, so the prediction cannot drift from the
 * rule the cron actually applies.
 */
export function nextDigestAt(schedule: DigestSchedule, now = new Date()): Date | null {
  if (!schedule.enabled) return null;

  const today = zonedParts(now, schedule.timezone);
  const horizon = schedule.frequency === 'monthly' ? 62 : 366;

  for (let offset = 0; offset <= horizon; offset += 1) {
    // Step in UTC days, then re-read the wall-clock date in the target zone.
    const walking = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const local = zonedParts(walking, 'UTC');
    const candidate = zonedTimeToUtc({ ...local, hour: schedule.hour }, schedule.timezone);

    if (candidate <= now) continue;
    if (isDigestDue(schedule, candidate)) return candidate;
  }

  return null;
}

/** e.g. "Biweekly on Monday at 07:00 Asia/Bangkok". */
export function describeSchedule(schedule: DigestSchedule) {
  const at = `at ${String(schedule.hour).padStart(2, '0')}:00 ${schedule.timezone}`;
  const day = WEEKDAYS[schedule.weekday]?.label ?? 'Monday';

  switch (schedule.frequency) {
    case 'daily':
      return `Every day ${at}`;
    case 'weekly':
      return `Every ${day} ${at}`;
    case 'biweekly':
      return `Every other ${day} ${at}`;
    case 'monthly':
      return `Day ${Math.min(schedule.dayOfMonth, MAX_DAY_OF_MONTH)} of each month ${at}`;
    case 'custom':
      return `Every ${schedule.intervalDays} days ${at}`;
    default:
      return at;
  }
}

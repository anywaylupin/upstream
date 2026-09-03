/**
 * Checks the digest schedule maths. Run with `pnpm check:schedule`.
 *
 * There is no test framework in this project on purpose, but this is the one
 * piece of non-obvious arithmetic - wall-clock time in an arbitrary IANA zone,
 * across DST and half-hour offsets - and it is where the bugs actually were:
 * a correction measured against the running guess instead of the target, and
 * a whole-hour rounding that put +05:30 zones half an hour late.
 *
 * Needs no env: everything here is pure.
 */

import { isDigestDue, nextDigestAt, zonedParts, zonedTimeToUtc } from '@/lib/digest-schedule';

let fails = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = String(got) === String(want);
  if (!ok) fails += 1;
  console.log(ok ? 'ok  ' : 'FAIL', name.padEnd(52), String(got), ok ? '' : `(want ${want})`);
}

// --- wall time -> instant, across DST boundaries ---
check(
  'NY 2026-01-15 07:00 (EST, -5)',
  zonedTimeToUtc({ year: 2026, month: 1, day: 15, hour: 7 }, 'America/New_York').toISOString(),
  '2026-01-15T12:00:00.000Z'
);
check(
  'NY 2026-07-15 07:00 (EDT, -4)',
  zonedTimeToUtc({ year: 2026, month: 7, day: 15, hour: 7 }, 'America/New_York').toISOString(),
  '2026-07-15T11:00:00.000Z'
);
check(
  'NY day after spring-forward',
  zonedTimeToUtc({ year: 2026, month: 3, day: 9, hour: 7 }, 'America/New_York').toISOString(),
  '2026-03-09T11:00:00.000Z'
);
check(
  'NY day after fall-back',
  zonedTimeToUtc({ year: 2026, month: 11, day: 2, hour: 7 }, 'America/New_York').toISOString(),
  '2026-11-02T12:00:00.000Z'
);
check(
  'Kolkata half-hour offset (+5:30)',
  zonedTimeToUtc({ year: 2026, month: 6, day: 1, hour: 9 }, 'Asia/Kolkata').toISOString(),
  '2026-06-01T03:30:00.000Z'
);
check(
  'Chatham quarter-hour (+12:45)',
  zonedParts(zonedTimeToUtc({ year: 2026, month: 6, day: 1, hour: 9 }, 'Pacific/Chatham'), 'Pacific/Chatham').hour,
  9
);
check(
  'UTC identity',
  zonedTimeToUtc({ year: 2026, month: 6, day: 1, hour: 9 }, 'UTC').toISOString(),
  '2026-06-01T09:00:00.000Z'
);

// --- every next run actually satisfies the rule, in every zone ---
const zones = ['UTC', 'America/New_York', 'Asia/Bangkok', 'Asia/Kolkata', 'Australia/Sydney', 'Europe/London'];
const now = new Date('2026-09-03T05:00:00Z');
for (const timezone of zones) {
  for (const frequency of ['daily', 'weekly', 'biweekly', 'monthly', 'custom'] as const) {
    const schedule = {
      enabled: true,
      frequency,
      hour: 7,
      weekday: 3,
      timezone,
      dayOfMonth: 12,
      intervalDays: 10,
      lastDigestAt: null
    };
    const next = nextDigestAt(schedule, now);
    if (!next) {
      check(`${timezone} ${frequency}`, 'NULL', 'a date');
      continue;
    }
    const local = zonedParts(next, timezone);
    const rule =
      local.hour === 7 &&
      next > now &&
      (frequency !== 'weekly' && frequency !== 'biweekly' ? true : local.weekday === 3) &&
      (frequency !== 'monthly' ? true : local.day === 12);
    check(`${timezone.padEnd(17)} ${frequency}`, rule && isDigestDue(schedule, next), true);
  }
}

// --- the gap rules ---
const day = 24 * 60 * 60 * 1000;
const wed = new Date('2026-09-09T00:00:00Z'); // Wednesday 07:00 Bangkok
const biweekly = {
  enabled: true,
  frequency: 'biweekly' as const,
  hour: 7,
  weekday: 3,
  timezone: 'Asia/Bangkok',
  dayOfMonth: 12,
  intervalDays: 10,
  lastDigestAt: null
};
check('biweekly fires when never sent', isDigestDue(biweekly, wed), true);
check(
  'biweekly skips 7 days after a send',
  isDigestDue({ ...biweekly, lastDigestAt: new Date(wed.getTime() - 7 * day) }, wed),
  false
);
check(
  'biweekly fires 14 days after a send',
  isDigestDue({ ...biweekly, lastDigestAt: new Date(wed.getTime() - 14 * day) }, wed),
  true
);

const custom = { ...biweekly, frequency: 'custom' as const, intervalDays: 10 };
check(
  'custom skips at 9 days',
  isDigestDue({ ...custom, lastDigestAt: new Date(wed.getTime() - 9 * day) }, wed),
  false
);
check(
  'custom fires at 10 days',
  isDigestDue({ ...custom, lastDigestAt: new Date(wed.getTime() - 10 * day) }, wed),
  true
);

// --- guards ---
check('opted out is never due', isDigestDue({ ...biweekly, enabled: false }, wed), false);
check('wrong hour is never due', isDigestDue(biweekly, new Date(wed.getTime() + 60 * 60 * 1000)), false);
check(
  'no double-send within the hour',
  isDigestDue({ ...biweekly, lastDigestAt: new Date(wed.getTime() - 60_000) }, wed),
  false
);
check('bad zone falls back to UTC', zonedParts(new Date('2026-09-03T05:00:00Z'), 'Not/AZone').hour, 5);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);

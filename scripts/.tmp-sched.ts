import { isDigestDue, nextDigestAt, zonedParts, zonedTimeToUtc } from '@/lib/digest-schedule';

const base = {
  enabled: true,
  hour: 7,
  weekday: 1,
  timezone: 'Asia/Bangkok',
  dayOfMonth: 12,
  intervalDays: 10,
  lastDigestAt: null
};

const now = new Date();
console.log('now              ', now.toISOString());
console.log('bangkok parts    ', JSON.stringify(zonedParts(now, 'Asia/Bangkok')));
console.log(
  'roundtrip Sep12 7',
  zonedTimeToUtc({ year: 2026, month: 9, day: 12, hour: 7 }, 'Asia/Bangkok').toISOString()
);

for (const frequency of ['daily', 'weekly', 'biweekly', 'monthly', 'custom'] as const) {
  const next = nextDigestAt({ ...base, frequency }, now);
  console.log(
    frequency.padEnd(9),
    next ? next.toISOString() : 'NULL',
    next ? '| local ' + JSON.stringify(zonedParts(next, 'Asia/Bangkok')) : '',
    next ? '| due=' + isDigestDue({ ...base, frequency }, next) : ''
  );
}

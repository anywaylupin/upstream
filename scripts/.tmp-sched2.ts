import { isDigestDue, zonedParts, zonedTimeToUtc } from '@/lib/digest-schedule';

const now = new Date();
const tz = 'Asia/Bangkok';
const today = zonedParts(now, tz);
console.log('today parts', JSON.stringify(today));

for (let offset = 0; offset < 4; offset += 1) {
  const walking = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
  const local = zonedParts(walking, 'UTC');
  const candidate = zonedTimeToUtc({ ...local, hour: 7 }, tz);
  console.log(
    'offset',
    offset,
    '| walking',
    walking.toISOString(),
    '| local',
    JSON.stringify(local),
    '| candidate',
    candidate.toISOString(),
    '| >now',
    candidate > now,
    '| due',
    isDigestDue(
      {
        enabled: true,
        frequency: 'daily',
        hour: 7,
        weekday: 1,
        timezone: tz,
        dayOfMonth: 12,
        intervalDays: 10,
        lastDigestAt: null
      },
      candidate
    )
  );
}

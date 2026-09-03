import { sql } from 'drizzle-orm';
import { db } from '@/db';

const UID = '6877087d-ae0a-4a06-ac24-91d4b6bde9e6';

async function main() {
  const freq = process.argv[2] ?? 'weekly';
  await db.execute(sql`
    INSERT INTO user_preferences (user_id, digest_frequency, digest_day_of_month, digest_interval_days, digest_timezone)
    VALUES (${UID}, ${freq}, 12, 10, 'Asia/Bangkok')
    ON CONFLICT (user_id) DO UPDATE SET
      digest_frequency = ${freq},
      digest_day_of_month = 12,
      digest_interval_days = 10,
      digest_timezone = 'Asia/Bangkok'
  `);
  console.log('frequency ->', freq);
}
main().then(() => process.exit(0));

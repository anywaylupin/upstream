import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { repos, runs, stackRepos, userPreferences } from '@/db/schema';
import { serverAiContext } from '@/lib/ai';
import { type DigestSchedule, isDigestDue } from '@/lib/digest-schedule';
import { ingestRepo } from '@/lib/ingest';
import { summarizePending } from '@/lib/summarize-batch';

/** Per-repo cap, so one busy repo cannot eat the whole run's rate budget. */
const SUMMARIES_PER_REPO = 5;

/**
 * The scheduled run: every repo that at least one user keeps in their stack.
 * Repos nobody tracks are left alone - the catalogue also holds repos people
 * merely looked at once.
 *
 * Errors are per repo. One dead repo or one rate-limited call must not end the
 * run, and because the summary queue is an anti-join, a run cut short simply
 * resumes where it left off next time.
 */
export async function runIngest(trigger: 'cron' | 'manual') {
  const [run] = await db.insert(runs).values({ trigger }).returning({ id: runs.id });
  if (!run) throw new Error('Could not open a run row');

  const tracked = await db.selectDistinct({ repoId: stackRepos.repoId }).from(stackRepos);
  const repoIds = tracked.map((row) => row.repoId);

  const targets = repoIds.length ? await db.select().from(repos).where(inArray(repos.id, repoIds)) : [];

  const ai = serverAiContext();
  let releasesFetched = 0;
  let releasesNew = 0;
  let summarized = 0;
  let errors = 0;

  for (const repo of targets) {
    try {
      const { fetched, inserted } = await ingestRepo(repo);
      releasesFetched += fetched;
      releasesNew += inserted;

      const result = await summarizePending(ai, {
        repoId: repo.id,
        limit: SUMMARIES_PER_REPO
      });
      summarized += result.summarized;
    } catch (err) {
      errors += 1;
      console.error(`run ${run.id}: ${repo.owner}/${repo.name} failed:`, err);
    }
  }

  const totals = {
    repos: targets.length,
    releasesFetched,
    releasesNew,
    summarized,
    errors
  };

  await db
    .update(runs)
    .set({ ...totals, finishedAt: new Date() })
    .where(eq(runs.id, run.id));

  return { id: run.id, ...totals };
}

export async function getRecentRuns(limit = 5) {
  return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit);
}

/** The stored schedule for one user, in the shape the date maths wants. */
export type UserSchedule = DigestSchedule & { userId: string; email: string | null };

function toSchedule(row: typeof userPreferences.$inferSelect): DigestSchedule {
  return {
    enabled: row.digestEnabled,
    frequency: row.digestFrequency,
    hour: row.digestHour,
    weekday: row.digestWeekday,
    timezone: row.digestTimezone,
    dayOfMonth: row.digestDayOfMonth,
    intervalDays: row.digestIntervalDays,
    lastDigestAt: row.lastDigestAt
  };
}

export async function getSchedule(userId: string) {
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return row ? toSchedule(row) : null;
}

/** Users whose digest is due this tick. */
export async function getDueUsers(now = new Date()): Promise<UserSchedule[]> {
  const rows = await db.select().from(userPreferences);

  return rows
    .map((row) => ({ userId: row.userId, email: row.digestEmail, ...toSchedule(row) }))
    .filter((row) => isDigestDue(row, now));
}

export async function markDigestSent(userIds: string[], now = new Date()) {
  if (userIds.length === 0) return;
  await db.update(userPreferences).set({ lastDigestAt: now }).where(inArray(userPreferences.userId, userIds));
}

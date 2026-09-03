import { and, count, eq, gte, inArray, isNotNull, max } from 'drizzle-orm';
import { cache } from 'react';
import type { StackRow } from '@/components/stack-table';
import { db } from '@/db';
import { releases, repoGuides, repos, stackRepos, summaries } from '@/db/schema';
import { DEFAULT_INSTRUCTIONS_HASH } from '@/lib/ai';
import { RepoGuide } from '@/lib/repo-guide';
import { RATING_WINDOW_DAYS } from '@/lib/repo-rating';
import { ReleaseSummary } from '@/lib/summarize';

export const WINDOW_DAYS = 30;

/** A guide written for the user's own instructions wins over the shared one. */
function pickGuides(rows: { repoId: number; instructionsHash: string; data: unknown }[], wantedHash: string) {
  const byRepo = new Map<number, RepoGuide>();
  for (const preferred of [wantedHash, DEFAULT_INSTRUCTIONS_HASH]) {
    for (const row of rows) {
      if (row.instructionsHash !== preferred) continue;
      if (byRepo.has(row.repoId)) continue;
      const parsed = RepoGuide.safeParse(row.data);
      if (parsed.success) byRepo.set(row.repoId, parsed.data);
    }
  }
  return byRepo;
}

export function windowStart(days = WINDOW_DAYS) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

export type RatingInputs = {
  repoId: number;
  owner: string;
  name: string;
  stars: number | null;
  forks: number | null;
  watchers: number | null;
  openIssues: number | null;
  pushedAt: Date | null;
  archived: boolean | null;
  license: string | null;
  totalReleases: number;
  releases90d: number;
  breaking90d: number;
  lastRelease: Date | null;
  guide: RepoGuide | null;
};

/**
 * Rating inputs for any set of repos, watched or not. Used to line a repo up
 * against the alternatives its guide suggests.
 */
export async function getRatingInputs(repoIds: number[], wantedHash: string = DEFAULT_INSTRUCTIONS_HASH) {
  const result = new Map<number, RatingInputs>();
  if (repoIds.length === 0) return result;

  const ratingSince = windowStart(RATING_WINDOW_DAYS);
  const mine = inArray(releases.repoId, repoIds);

  const [repoRows, totals, ratingRows, guideRows] = await Promise.all([
    db.select().from(repos).where(inArray(repos.id, repoIds)),
    db
      .select({ repoId: releases.repoId, latest: max(releases.publishedAt) })
      .from(releases)
      .where(mine)
      .groupBy(releases.repoId),
    db
      .select({ repoId: releases.repoId, data: summaries.data })
      .from(releases)
      .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
      .where(and(mine, isNotNull(releases.publishedAt), gte(releases.publishedAt, ratingSince))),
    db
      .select({
        repoId: repoGuides.repoId,
        instructionsHash: repoGuides.instructionsHash,
        data: repoGuides.data
      })
      .from(repoGuides)
      .where(inArray(repoGuides.repoId, repoIds))
  ]);

  const latestByRepo = new Map(totals.map((t) => [t.repoId, t.latest]));

  const counts = new Map<number, { total: number; breaking: number }>();
  for (const row of ratingRows) {
    const bucket = counts.get(row.repoId) ?? { total: 0, breaking: 0 };
    bucket.total += 1;
    const parsed = ReleaseSummary.safeParse(row.data);
    if (parsed.success && parsed.data.changes.some((change) => change.type === 'breaking')) {
      bucket.breaking += 1;
    }
    counts.set(row.repoId, bucket);
  }

  const guides = pickGuides(guideRows, wantedHash);

  for (const repo of repoRows) {
    result.set(repo.id, {
      repoId: repo.id,
      owner: repo.owner,
      name: repo.name,
      stars: repo.stars,
      forks: repo.forks,
      watchers: repo.watchers,
      openIssues: repo.openIssues,
      pushedAt: repo.pushedAt,
      archived: repo.archived,
      license: repo.license,
      totalReleases: 0,
      releases90d: counts.get(repo.id)?.total ?? 0,
      breaking90d: counts.get(repo.id)?.breaking ?? 0,
      lastRelease: latestByRepo.get(repo.id) ?? null,
      guide: guides.get(repo.id) ?? null
    });
  }

  return result;
}

/**
 * Report numbers for the repos one user watches. Repos themselves are shared -
 * that is what keeps ingestion and summary dedupe global - but every view of
 * them is scoped to the person asking.
 */
export const getStackStats = cache(async function getStackStats(
  userId: string,
  wantedHash: string = DEFAULT_INSTRUCTIONS_HASH
) {
  const since = windowStart();
  const ratingSince = windowStart(RATING_WINDOW_DAYS);

  const watched = await db
    .select({ watchedId: stackRepos.id, repoId: stackRepos.repoId })
    .from(stackRepos)
    .where(eq(stackRepos.userId, userId));

  const repoIds = watched.map((w) => w.repoId);
  if (repoIds.length === 0) {
    return {
      rows: [],
      totals: { repos: 0, releases30d: 0, breaking30d: 0, summariesCached: 0 }
    };
  }

  const watchedIdByRepo = new Map(watched.map((w) => [w.repoId, w.watchedId]));
  const mine = inArray(releases.repoId, repoIds);

  const [repoRows, totals, windowCounts, windowSummaries, ratingRows, guideRows] = await Promise.all([
    db.select().from(repos).where(inArray(repos.id, repoIds)).orderBy(repos.owner, repos.name),
    db
      .select({
        repoId: releases.repoId,
        total: count(),
        latest: max(releases.publishedAt)
      })
      .from(releases)
      .where(mine)
      .groupBy(releases.repoId),
    db
      .select({ repoId: releases.repoId, total: count() })
      .from(releases)
      .where(and(mine, isNotNull(releases.publishedAt), gte(releases.publishedAt, since)))
      .groupBy(releases.repoId),
    db
      .select({ repoId: releases.repoId, data: summaries.data })
      .from(releases)
      .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
      .where(and(mine, isNotNull(releases.publishedAt), gte(releases.publishedAt, since))),
    db
      .select({ repoId: releases.repoId, data: summaries.data })
      .from(releases)
      .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
      .where(and(mine, isNotNull(releases.publishedAt), gte(releases.publishedAt, ratingSince))),
    db
      .select({
        repoId: repoGuides.repoId,
        instructionsHash: repoGuides.instructionsHash,
        data: repoGuides.data
      })
      .from(repoGuides)
      .where(inArray(repoGuides.repoId, repoIds))
  ]);

  const guideByRepo = pickGuides(guideRows, wantedHash);

  const totalsByRepo = new Map(totals.map((t) => [t.repoId, t]));
  const windowByRepo = new Map(windowCounts.map((w) => [w.repoId, w.total]));

  const breakingByRepo = new Map<number, number>();
  for (const row of windowSummaries) {
    const parsed = ReleaseSummary.safeParse(row.data);
    if (!parsed.success) continue;
    if (!parsed.data.changes.some((change) => change.type === 'breaking')) {
      continue;
    }
    breakingByRepo.set(row.repoId, (breakingByRepo.get(row.repoId) ?? 0) + 1);
  }

  const rating90dByRepo = new Map<number, { total: number; breaking: number }>();
  for (const row of ratingRows) {
    const bucket = rating90dByRepo.get(row.repoId) ?? { total: 0, breaking: 0 };
    bucket.total += 1;
    const parsed = ReleaseSummary.safeParse(row.data);
    if (parsed.success && parsed.data.changes.some((change) => change.type === 'breaking')) {
      bucket.breaking += 1;
    }
    rating90dByRepo.set(row.repoId, bucket);
  }

  const rows: StackRow[] = repoRows.map((repo) => ({
    repoId: repo.id,
    owner: repo.owner,
    name: repo.name,
    description: repo.description,
    stars: repo.stars,
    forks: repo.forks,
    watchers: repo.watchers,
    openIssues: repo.openIssues,
    pushedAt: repo.pushedAt,
    archived: repo.archived,
    license: repo.license,
    lastIngestedAt: repo.lastIngestedAt,
    totalReleases: totalsByRepo.get(repo.id)?.total ?? 0,
    releases30d: windowByRepo.get(repo.id) ?? 0,
    breaking30d: breakingByRepo.get(repo.id) ?? 0,
    lastRelease: totalsByRepo.get(repo.id)?.latest ?? null,
    stackId: watchedIdByRepo.get(repo.id),
    releases90d: rating90dByRepo.get(repo.id)?.total ?? 0,
    breaking90d: rating90dByRepo.get(repo.id)?.breaking ?? 0,
    guide: guideByRepo.get(repo.id) ?? null
  }));

  return {
    rows,
    totals: {
      repos: rows.length,
      releases30d: rows.reduce((sum, row) => sum + row.releases30d, 0),
      breaking30d: rows.reduce((sum, row) => sum + row.breaking30d, 0),
      summariesCached: windowSummaries.length
    }
  };
});

/** Small counts for the nav tabs - deliberately cheaper than the full stats. */
export async function getNavCounts(userId: string) {
  const stack = await db.select({ repoId: stackRepos.repoId }).from(stackRepos).where(eq(stackRepos.userId, userId));

  const repoIds = stack.map((row) => row.repoId);
  if (repoIds.length === 0) return { stack: 0, releases30d: 0 };

  const [releaseRows] = await db
    .select({ total: count() })
    .from(releases)
    .where(
      and(inArray(releases.repoId, repoIds), isNotNull(releases.publishedAt), gte(releases.publishedAt, windowStart()))
    );

  return { stack: repoIds.length, releases30d: releaseRows?.total ?? 0 };
}

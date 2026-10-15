import { and, count, desc, eq, gte, inArray, isNotNull, or } from 'drizzle-orm';
import type { CompareRow } from '@/components/alternatives-compare';
import { db } from '@/db';
import { releases, repos, stackRepos, summaries } from '@/db/schema';
import { getAiContext } from '@/lib/ai';
import { getGitHubToken, getRepoMeta } from '@/lib/github';
import { findRepoIcon } from '@/lib/repo-icon';
import { rateRepo } from '@/lib/repo-rating';
import { getRatingInputs, getRatingWeights, windowStart } from '@/lib/repo-stats';
import { ReleaseSummary as ReleaseSummarySchema } from '@/lib/summarize';

/**
 * Everything the repo page shows, in one place so the page only renders.
 * Visiting a repo adds it to the shared catalogue (not to anyone's stack) so a guide and releases have an id to hang off.
 * Null when GitHub has no such repo.
 *
 * Every repo gets a page, stacked or not.
 * On first visit the repo is added to the shared catalogue - not to anyone's stack - so it has an id to hang a guide and releases off, and Explain works straight away.
 *
 * Resolve the alternatives the guide named against repos we already know about, so anything tracked can be compared on the same rating scale.
 */
export async function getRepoReport(userId: string, owner: string, name: string) {
  const ai = await getAiContext(userId);

  let [repo] = await db
    .select()
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.name, name)));

  if (!repo) {
    const token = (await getGitHubToken(userId)) ?? process.env.GITHUB_TOKEN;
    if (!token) return null;

    const meta = await getRepoMeta(owner, name, token).catch(() => null);
    if (!meta) return null;

    await db
      .insert(repos)
      .values({
        owner: meta.owner.login,
        name: meta.name,
        description: meta.description,
        stars: meta.stargazers_count,
        forks: meta.forks_count,
        watchers: meta.subscribers_count ?? null,
        openIssues: meta.open_issues_count,
        pushedAt: meta.pushed_at ? new Date(meta.pushed_at) : null,
        archived: meta.archived,
        license: meta.license?.spdx_id ?? null,
        iconUrl: await findRepoIcon(meta.homepage)
      })
      .onConflictDoNothing();

    [repo] = await db
      .select()
      .from(repos)
      .where(and(eq(repos.owner, owner), eq(repos.name, name)));
    if (!repo) return null;
  }

  const since = windowStart();

  const [releaseRows, totalRows, windowRows, windowSummaries, ratingInputs, weights] = await Promise.all([
    db
      .select({
        releaseId: releases.id,
        tag: releases.tag,
        publishedAt: releases.publishedAt,
        data: summaries.data
      })
      .from(releases)
      .leftJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
      .where(eq(releases.repoId, repo.id))
      .orderBy(desc(releases.publishedAt))
      .limit(25),
    db.select({ total: count() }).from(releases).where(eq(releases.repoId, repo.id)),
    db
      .select({ total: count() })
      .from(releases)
      .where(and(eq(releases.repoId, repo.id), isNotNull(releases.publishedAt), gte(releases.publishedAt, since))),
    db
      .select({ data: summaries.data })
      .from(releases)
      .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
      .where(and(eq(releases.repoId, repo.id), isNotNull(releases.publishedAt), gte(releases.publishedAt, since))),
    getRatingInputs([repo.id], ai.instructionsHash),
    getRatingWeights(userId)
  ]);

  const self = ratingInputs.get(repo.id);
  const guide = self?.guide ?? null;
  const rating = self ? rateRepo(self, weights) : null;

  const breaking30d = windowSummaries.filter((row) => {
    const parsed = ReleaseSummarySchema.safeParse(row.data);
    return parsed.success && parsed.data.changes.some((change) => change.type === 'breaking');
  }).length;

  const alternatives = guide?.alternatives ?? [];
  const altPairs = alternatives
    .map((alt) => alt.repo.split('/'))
    .filter((parts): parts is [string, string] => parts.length === 2);

  const altRepoRows = altPairs.length
    ? await db
        .select({ id: repos.id, owner: repos.owner, name: repos.name })
        .from(repos)
        .where(or(...altPairs.map(([o, n]) => and(eq(repos.owner, o), eq(repos.name, n)))))
    : [];

  const altIds = altRepoRows.map((r) => r.id);
  const [altRatings, stackRows] = await Promise.all([
    getRatingInputs(altIds, ai.instructionsHash),
    db
      .select({ id: stackRepos.id, repoId: stackRepos.repoId })
      .from(stackRepos)
      .where(and(eq(stackRepos.userId, userId), inArray(stackRepos.repoId, [repo.id, ...altIds])))
  ]);

  const stackIdByRepo = new Map(stackRows.map((w) => [w.repoId, w.id]));
  const altIdByFullName = new Map(altRepoRows.map((r) => [`${r.owner}/${r.name}`, r.id]));

  const compareRows: CompareRow[] = [
    {
      repo: `${repo.owner}/${repo.name}`,
      tradeoff: guide?.verdict ?? null,
      rating,
      stars: repo.stars,
      isCurrent: true
    },
    ...alternatives.map((alt) => {
      const altId = altIdByFullName.get(alt.repo);
      const inputs = altId ? altRatings.get(altId) : undefined;
      return {
        repo: alt.repo,
        tradeoff: alt.tradeoff,
        rating: inputs ? rateRepo(inputs, weights) : null,
        stars: inputs?.stars ?? null,
        isCurrent: false,
        repoId: altId && stackIdByRepo.has(altId) ? altId : undefined
      };
    })
  ].sort((a, b) => (b.rating?.overall ?? -1) - (a.rating?.overall ?? -1));

  return { repo, guide, rating, self, releaseRows, totalRows, windowRows, breaking30d, compareRows, stackIdByRepo };
}

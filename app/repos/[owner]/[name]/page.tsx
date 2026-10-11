import { and, count, desc, eq, gte, inArray, isNotNull, or } from 'drizzle-orm';
import {
  BookOpenIcon,
  ExternalLinkIcon,
  GitCompareIcon,
  PackageIcon,
  RefreshCwIcon,
  StarIcon,
  TagIcon
} from 'lucide-react';
import { notFound } from 'next/navigation';
import { AlternativesCompare, type CompareRow } from '@/components/alternatives-compare';
import { GenerateGuideButton } from '@/components/generate-guide-button';
import { OwnerAvatar } from '@/components/owner-avatar';
import { RatingBars } from '@/components/rating-badge';
import { RefreshRepoButton } from '@/components/refresh-repo-button';
import { ScoreRing } from '@/components/score-ring';
import { StackButton } from '@/components/stack-button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VerdictBadge } from '@/components/verdict-badge';
import { db } from '@/db';
import { releases, repos, stackRepos, summaries } from '@/db/schema';
import { getAiContext } from '@/lib/ai';
import { upgradeVerdict } from '@/lib/digest-filters';
import { formatDate, formatRelative } from '@/lib/format';
import { getGitHubToken, getRepoMeta } from '@/lib/github';
import { rateRepo } from '@/lib/repo-rating';
import { getRatingInputs, getRatingWeights, windowStart } from '@/lib/repo-stats';
import { requireUser } from '@/lib/session';
import { type ReleaseSummary, ReleaseSummary as ReleaseSummarySchema } from '@/lib/summarize';

const BADGE_VARIANT: Record<
  ReleaseSummary['changes'][number]['type'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  breaking: 'destructive',
  feature: 'default',
  fix: 'secondary',
  perf: 'outline',
  deprecation: 'outline'
};

export default async function RepoReport({ params }: { params: Promise<{ owner: string; name: string }> }) {
  const user = await requireUser();
  const { owner, name } = await params;

  const ai = await getAiContext(user.id);

  // Every repo gets a page, stacked or not. On first visit the repo is added to
  // the shared catalogue - not to anyone's stack - so it has an id to hang a
  // guide and releases off, and Explain works straight away.
  let [repo] = await db
    .select()
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.name, name)));

  if (!repo) {
    const token = (await getGitHubToken(user.id)) ?? process.env.GITHUB_TOKEN;
    if (!token) notFound();

    const meta = await getRepoMeta(owner, name, token).catch(() => null);
    if (!meta) notFound();

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
        license: meta.license?.spdx_id ?? null
      })
      .onConflictDoNothing();

    [repo] = await db
      .select()
      .from(repos)
      .where(and(eq(repos.owner, owner), eq(repos.name, name)));
    if (!repo) notFound();
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
    getRatingWeights(user.id)
  ]);

  const self = ratingInputs.get(repo.id);
  const guide = self?.guide ?? null;
  const rating = self ? rateRepo(self, weights) : null;

  const breaking30d = windowSummaries.filter((row) => {
    const parsed = ReleaseSummarySchema.safeParse(row.data);
    return parsed.success && parsed.data.changes.some((change) => change.type === 'breaking');
  }).length;

  // Resolve the alternatives the guide named against repos we already know about,
  // so anything tracked can be compared on the same rating scale.
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
      .where(and(eq(stackRepos.userId, user.id), inArray(stackRepos.repoId, [repo.id, ...altIds])))
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

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="flex flex-wrap items-center gap-2 font-heading font-semibold text-2xl tracking-tight">
            <OwnerAvatar owner={repo.owner} size={28} />
            {repo.owner}/{repo.name}
            <a
              href={`https://github.com/${repo.owner}/${repo.name}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Open on GitHub"
            >
              <ExternalLinkIcon className="size-4" />
            </a>
          </h1>

          {/* The one-line verdict is the most useful sentence on the page, so it leads. */}
          {guide?.verdict && <p className="max-w-2xl text-base">{guide.verdict}</p>}
          <p className="max-w-2xl text-muted-foreground text-sm">
            {guide?.whatItIs ?? repo.description ?? 'No description yet.'}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {breaking30d > 0 && <Badge variant="destructive">{breaking30d} breaking this month</Badge>}
            {guide?.bestFor.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
            {repo.stars !== null && (
              <span className="inline-flex items-center gap-1">
                <StarIcon className="size-3.5" />
                {repo.stars.toLocaleString()}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <TagIcon className="size-3.5" />
              {totalRows[0]?.total ?? 0} releases, {windowRows[0]?.total ?? 0} this month
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshCwIcon className="size-3.5" />
              synced {formatRelative(repo.lastIngestedAt)}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <RefreshRepoButton repoId={repo.id} />
          <GenerateGuideButton repoId={repo.id} hasGuide={Boolean(guide)} />
          <StackButton owner={repo.owner} name={repo.name} repoId={stackIdByRepo.has(repo.id) ? repo.id : undefined} />
        </div>
      </header>

      {rating && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-lg tracking-tight">Rating</h2>
          <div className="grid animate-rise items-center gap-6 rounded-xl p-5 ring-1 ring-foreground/10 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-1">
              <ScoreRing score={rating.overall} size={96} />
              <span className="text-muted-foreground text-sm">out of 10</span>
            </div>
            <RatingBars rating={rating} />
          </div>
        </section>
      )}

      {guide ? (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
            <BookOpenIcon className="size-4 text-muted-foreground" />
            How to use
          </h2>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="lift flex animate-rise flex-col gap-3 rounded-lg p-3 ring-1 ring-foreground/10 hover:ring-foreground/25">
              {guide.install && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Install</span>
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">{guide.install}</pre>
                </div>
              )}
              {guide.quickStart && (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Quick start</span>
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">{guide.quickStart}</pre>
                </div>
              )}
            </div>

            <div className="lift flex animate-rise flex-col gap-3 rounded-lg p-3 ring-1 ring-foreground/10 hover:ring-foreground/25">
              {guide.keyConcepts.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs">Key concepts</span>
                  <ul className="flex flex-col gap-1">
                    {guide.keyConcepts.map((concept) => (
                      <li key={concept.name} className="text-sm">
                        <span className="font-medium">{concept.name}</span>{' '}
                        <span className="text-muted-foreground">- {concept.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {guide.gotchas.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs">Gotchas</span>
                  <ul className="flex list-disc flex-col gap-1 pl-4">
                    {guide.gotchas.map((gotcha) => (
                      <li key={gotcha} className="text-muted-foreground text-sm">
                        {gotcha}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">No guide yet. Run Explain.</p>
      )}

      {compareRows.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
            <GitCompareIcon className="size-4 text-muted-foreground" />
            Alternatives
          </h2>
          <AlternativesCompare rows={compareRows} />
          <p className="text-muted-foreground text-xs">Follow one to score it.</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
          <PackageIcon className="size-4 text-muted-foreground" />
          Releases
        </h2>
        {releaseRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No releases yet. Sync to fetch them.</p>
        ) : (
          <div className="rounded-lg ring-1 ring-foreground/10">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Tag</TableHead>
                  <TableHead className="hidden w-28 sm:table-cell">Date</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="hidden w-40 lg:table-cell">Changes</TableHead>
                  <TableHead className="w-24">Upgrade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releaseRows.map((row) => {
                  const parsed = ReleaseSummarySchema.safeParse(row.data);
                  return (
                    <TableRow key={row.releaseId}>
                      <TableCell className="whitespace-normal break-words font-mono text-xs">{row.tag}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatDate(row.publishedAt)}
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {parsed.success ? parsed.data.headline : '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {parsed.success && (
                          <div className="flex flex-wrap gap-1">
                            {[...new Set(parsed.data.changes.map((c) => c.type))].map((type) => (
                              <Badge key={type} variant={BADGE_VARIANT[type]}>
                                {type}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {parsed.success ? <VerdictBadge verdict={upgradeVerdict(parsed.data)} /> : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

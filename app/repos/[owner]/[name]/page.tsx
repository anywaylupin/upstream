import { and, count, desc, eq, gte, inArray, isNotNull, or } from 'drizzle-orm';
import { SparklesIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AlternativesCompare, type CompareRow } from '@/components/alternatives-compare';
import { CodeBlock } from '@/components/code-block';
import { GenerateGuideButton } from '@/components/generate-guide-button';
import { OwnerAvatar } from '@/components/owner-avatar';
import { RatingBars } from '@/components/rating-badge';
import { RepoActions } from '@/components/repo-actions';
import { type RepoTab, RepoTabs } from '@/components/repo-tabs';
import { ScoreRing } from '@/components/score-ring';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
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

export default async function RepoReport({
  params,
  searchParams
}: {
  params: Promise<{ owner: string; name: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { owner, name } = await params;
  const requestedTab = (await searchParams).tab;
  const initialTab: RepoTab =
    requestedTab === 'releases' || requestedTab === 'alternatives' ? requestedTab : 'overview';

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

  const facts: { label: string; value: ReactNode }[] = [
    {
      label: 'Score',
      value: rating ? (
        <span className="inline-flex items-center gap-2">
          <ScoreRing score={rating.overall} size={28} />
          <span className="text-muted-foreground">/ 10</span>
        </span>
      ) : (
        '-'
      )
    },
    { label: 'Stars', value: (repo.stars ?? 0).toLocaleString() },
    { label: 'Releases', value: (totalRows[0]?.total ?? 0).toLocaleString() },
    { label: 'This month', value: windowRows[0]?.total ?? 0 },
    { label: 'Last release', value: self?.lastRelease ? formatRelative(self.lastRelease) : 'never' },
    { label: 'Checked', value: repo.lastIngestedAt ? formatRelative(repo.lastIngestedAt) : 'not yet' }
  ];

  const overview = (
    <div className="flex flex-col gap-6">
      {rating && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-lg tracking-tight">Rating</h2>
          <div className="grid items-center gap-6 rounded-xl p-5 ring-1 ring-foreground/10 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-1">
              <ScoreRing score={rating.overall} size={96} />
              <span className="text-muted-foreground text-sm">out of 10</span>
            </div>
            <RatingBars rating={rating} />
          </div>
        </section>
      )}

      {guide ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-lg tracking-tight">How to use</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-xl p-5 ring-1 ring-foreground/10">
              {guide.install && <CodeBlock label="Install" code={guide.install} />}
              {guide.quickStart && <CodeBlock label="Quick start" code={guide.quickStart} />}
              {!guide.install && !guide.quickStart && (
                <p className="text-muted-foreground text-sm">The README has no install steps.</p>
              )}
            </div>

            <div className="flex flex-col gap-5 rounded-xl p-5 ring-1 ring-foreground/10">
              {guide.keyConcepts.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium text-sm">Key concepts</h3>
                  <dl className="flex flex-col gap-2.5">
                    {guide.keyConcepts.map((concept) => (
                      <div key={concept.name} className="text-sm">
                        <dt className="font-medium">{concept.name}</dt>
                        <dd className="text-muted-foreground">{concept.description}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {guide.gotchas.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="font-medium text-sm">Gotchas</h3>
                  <ul className="flex list-disc flex-col gap-1.5 pl-4 text-muted-foreground text-sm marker:text-amber-500">
                    {guide.gotchas.map((gotcha) => (
                      <li key={gotcha}>{gotcha}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <Empty className="rounded-xl ring-1 ring-foreground/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SparklesIcon />
            </EmptyMedia>
            <EmptyTitle>No guide yet</EmptyTitle>
            <EmptyDescription>Read the README with AI to rate this repo and find alternatives.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <GenerateGuideButton repoId={repo.id} hasGuide={false} />
          </EmptyContent>
        </Empty>
      )}
    </div>
  );

  const releasesPanel =
    releaseRows.length === 0 ? (
      <p className="text-muted-foreground text-sm">No releases yet. Check for new releases from the menu.</p>
    ) : (
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Tag</TableHead>
              <TableHead className="hidden w-32 sm:table-cell">Date</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="hidden w-44 lg:table-cell">Changes</TableHead>
              <TableHead className="w-24">Upgrade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releaseRows.map((row) => {
              const parsed = ReleaseSummarySchema.safeParse(row.data);
              return (
                <TableRow key={row.releaseId}>
                  <TableCell className="whitespace-normal break-words font-mono text-[13px]">{row.tag}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDate(row.publishedAt)}
                  </TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">
                    {parsed.success ? parsed.data.headline : 'Waiting for a summary'}
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
                  <TableCell>{parsed.success ? <VerdictBadge verdict={upgradeVerdict(parsed.data)} /> : '-'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );

  const alternativesPanel =
    compareRows.length > 1 ? (
      <div className="flex flex-col gap-2">
        <AlternativesCompare rows={compareRows} />
        <p className="text-muted-foreground text-sm">Follow one to score it on your weights.</p>
      </div>
    ) : (
      <p className="text-muted-foreground text-sm">
        {guide ? 'The guide named no alternatives that exist on GitHub.' : 'Alternatives come with the AI guide.'}
      </p>
    );

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="flex items-center gap-2.5 font-heading font-semibold text-2xl tracking-tight">
              <OwnerAvatar owner={repo.owner} size={32} />
              <span className="truncate">
                <span className="text-muted-foreground">{repo.owner}/</span>
                {repo.name}
              </span>
            </h1>
            {/* The one-line verdict is the most useful sentence on the page, so it leads. */}
            {guide?.verdict && <p className="max-w-2xl text-base">{guide.verdict}</p>}
            <p className="max-w-2xl text-muted-foreground text-sm">
              {guide?.whatItIs ?? repo.description ?? 'No description yet.'}
            </p>
            {(breaking30d > 0 || (guide?.bestFor.length ?? 0) > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {breaking30d > 0 && <Badge variant="destructive">{breaking30d} breaking this month</Badge>}
                {guide?.bestFor.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <RepoActions
            repoId={repo.id}
            owner={repo.owner}
            name={repo.name}
            followed={stackIdByRepo.has(repo.id)}
            hasGuide={Boolean(guide)}
          />
        </div>

        {/* Facts as labelled cells rather than a run of icons and numbers. */}
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl ring-1 ring-foreground/10 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-border">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-1 px-4 py-3">
              <dt className="text-muted-foreground text-xs">{fact.label}</dt>
              <dd className="flex min-h-7 items-center font-medium text-sm tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <RepoTabs
        initial={initialTab}
        counts={{ releases: totalRows[0]?.total ?? 0, alternatives: Math.max(0, compareRows.length - 1) }}
        panels={{ overview, releases: releasesPanel, alternatives: alternativesPanel }}
      />
    </div>
  );
}

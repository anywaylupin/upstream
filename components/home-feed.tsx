import { eq, inArray } from 'drizzle-orm';
import { BellIcon, SearchXIcon } from 'lucide-react';
import Link from 'next/link';
import { DigestFilters } from '@/components/digest-filters';
import { EmptyStack } from '@/components/empty-stack';
import { PageHeader } from '@/components/page-header';
import { RepoRow } from '@/components/repo-row';
import { SummarizeButton } from '@/components/summarize-button';
import { SummarizeReleaseButton } from '@/components/summarize-release-button';
import { SyncStackButton } from '@/components/sync-stack-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ItemGroup } from '@/components/ui/item';
import { StageMark, VerdictBadge } from '@/components/verdict-badge';
import { db } from '@/db';
import { repos, userInstructions } from '@/db/schema';
import { findModel } from '@/lib/ai-models';
import { getUserAiSummary } from '@/lib/ai-settings';
import { CHANGE_TYPES, EFFORTS, upgradeVerdict, WINDOWS } from '@/lib/digest-filters';
import { formatRelative } from '@/lib/format';
import { getRecentReleases, getStackRepoIds, windowStart } from '@/lib/repo-stats';
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

type Entry = {
  releaseId: number;
  tag: string;
  publishedAt: Date;
  repo: string;
  summary: ReleaseSummary;
  relevant: boolean;
};

const STAGE_TITLE = { breaking: 'Breaking', review: 'Review', safe: 'Safe' } as const;

function parseList(value: string | undefined, allowed?: readonly string[]) {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return allowed ? items.filter((item) => allowed.includes(item)) : items;
}

function keywordsFrom(instructions: string) {
  return [
    ...new Set(
      instructions
        .toLowerCase()
        .split(/[^a-z0-9.+#-]+/)
        .filter((word) => word.length >= 4)
    )
  ].slice(0, 25);
}

/**
 * Home: every release in the window, grouped by upgrade stage so breaking ones lead, with unsummarized releases folded into one row.
 * The title counts before the filters: a filter that hid everything used to make it say "All clear".
 * It replaced both the dashboard and the Updates tab, which answered the same question from two pages.
 *
 * An empty stack and an over-tight filter are different problems, so only the first one offers the follow-a-repo actions.
 */
export async function HomeFeed({
  searchParams
}: {
  searchParams: Promise<{
    types?: string;
    effort?: string;
    repos?: string;
    days?: string;
    q?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const types = parseList(params.types, CHANGE_TYPES);
  const effort = parseList(params.effort, EFFORTS);
  const repoFilter = parseList(params.repos);
  const days = WINDOWS.find((w) => String(w) === params.days) ?? 30;
  const q = (params.q ?? '').trim().toLowerCase();

  const repoIds = await getStackRepoIds(user.id);

  const [rows, repoList, preferences] = await Promise.all([
    getRecentReleases(repoIds, windowStart(days)),
    repoIds.length
      ? db
          .select({ owner: repos.owner, name: repos.name })
          .from(repos)
          .where(inArray(repos.id, repoIds))
          .orderBy(repos.owner, repos.name)
      : Promise.resolve([]),
    db
      .select({
        feature: userInstructions.feature,
        text: userInstructions.text
      })
      .from(userInstructions)
      .where(eq(userInstructions.userId, user.id))
  ]);

  const byFeature = new Map(preferences.map((row) => [row.feature, row.text]));
  const keywords = keywordsFrom(byFeature.get('summary') ?? byFeature.get('global') ?? '');

  const entries: Entry[] = [];
  const pendingRows: typeof rows = [];
  let allBreaking = 0;
  let allPending = 0;
  for (const row of rows) {
    const { releaseId, tag, publishedAt, owner, name, data } = row;
    if (!publishedAt) continue;
    if (data === null) {
      allPending += 1;
      const repo = `${owner}/${name}`;
      const matchesRepo = !repoFilter.length || repoFilter.includes(repo);
      const matchesQuery = !q || `${repo} ${tag}`.toLowerCase().includes(q);
      if (matchesRepo && matchesQuery && !types.length && !effort.length) pendingRows.push(row);
      continue;
    }

    const parsed = ReleaseSummarySchema.safeParse(data);
    if (!parsed.success) {
      console.error(`Invalid summary for release ${releaseId}`, parsed.error);
      continue;
    }
    if (upgradeVerdict(parsed.data) === 'breaking') allBreaking += 1;

    const repo = `${owner}/${name}`;
    if (repoFilter.length && !repoFilter.includes(repo)) continue;
    if (effort.length && !effort.includes(parsed.data.upgradeEffort)) continue;

    const changes = types.length
      ? parsed.data.changes.filter((change) => types.includes(change.type))
      : parsed.data.changes;
    if (types.length && changes.length === 0) continue;

    const summary = { ...parsed.data, changes };
    const haystack = [repo, tag, summary.headline, ...summary.changes.map((c) => c.description)]
      .join(' ')
      .toLowerCase();

    if (q && !haystack.includes(q)) continue;

    entries.push({
      releaseId,
      tag,
      publishedAt,
      repo,
      summary,
      relevant: keywords.length > 0 && keywords.some((keyword) => haystack.includes(keyword))
    });
  }

  const stages = (['breaking', 'review', 'safe'] as const).map((verdict) => ({
    verdict,
    entries: entries
      .filter((entry) => upgradeVerdict(entry.summary) === verdict)
      .sort((x, y) => Number(y.relevant) - Number(x.relevant))
  }));

  const pending = pendingRows.length;
  const total = entries.length + pending;
  const ai = await getUserAiSummary(user.id);
  const modelLabel = findModel(ai.modelId)?.label ?? ai.modelId;

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title={
          allBreaking > 0
            ? `${allBreaking} breaking change${allBreaking === 1 ? '' : 's'}`
            : allPending > 0
              ? `${allPending} release${allPending === 1 ? '' : 's'} to summarize`
              : 'All clear'
        }
        description={`${total} release${total === 1 ? '' : 's'} in the last ${days} days`}
        action={
          repoIds.length > 0 && (
            <>
              <SyncStackButton />
              {allPending > 0 && <SummarizeButton model={modelLabel} />}
            </>
          )
        }
      />

      <DigestFilters
        repos={repoList.map((r) => `${r.owner}/${r.name}`)}
        selected={{ types, effort, repos: repoFilter, days, q }}
      />

      {total === 0 &&
        (repoIds.length === 0 ? (
          <EmptyStack icon={BellIcon} title="No releases yet" description="Follow a repo to see its releases." />
        ) : (
          <Empty className="animate-rise border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>No matches</EmptyTitle>
              <EmptyDescription>Try widening the filters.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ))}

      {stages.map(
        ({ verdict, entries: group }) =>
          group.length > 0 && (
            <section key={verdict} className="flex flex-col gap-3" aria-labelledby={`stage-${verdict}`}>
              <h2 id={`stage-${verdict}`} className="flex items-center gap-2 font-heading font-semibold text-lg">
                <StageMark verdict={verdict} className="size-3.5" />
                {STAGE_TITLE[verdict]} · {group.length}
              </h2>
              <div className="flex flex-col gap-3">
                {group.map((entry) => (
                  <Card key={entry.releaseId} size="sm">
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-baseline gap-2">
                        <Link href={`/repos/${entry.repo}`} className="hover:underline">
                          {entry.repo}
                        </Link>
                        <span className="font-normal text-muted-foreground text-xs tabular-nums">{entry.tag}</span>
                        {entry.relevant && <Badge variant="secondary">For you</Badge>}
                        <span className="ml-auto flex items-center gap-3 font-normal text-muted-foreground text-xs">
                          {formatRelative(entry.publishedAt)}
                          <VerdictBadge verdict={verdict} />
                        </span>
                      </CardTitle>
                      <span className="text-muted-foreground text-sm">{entry.summary.headline}</span>
                    </CardHeader>
                    <CardContent>
                      <ul className="flex flex-col gap-1.5">
                        {entry.summary.changes.map((change, i) => (
                          <li key={`${entry.releaseId}-${i}`} className="flex items-start gap-2 text-sm">
                            <Badge variant={BADGE_VARIANT[change.type]} className="mt-0.5 shrink-0">
                              {change.type}
                            </Badge>
                            <span
                              className={
                                change.type === 'breaking' ? 'font-medium text-foreground' : 'text-muted-foreground'
                              }
                            >
                              {change.description}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )
      )}

      {pending > 0 && (
        <details className="group rounded-lg border bg-card" open={entries.length === 0}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium text-sm [&::-webkit-details-marker]:hidden">
            <StageMark verdict="pending" className="size-3.5" />
            {pending} not summarized
            <span className="ml-auto text-muted-foreground group-open:hidden">Show</span>
            <span className="ml-auto hidden text-muted-foreground group-open:inline">Hide</span>
          </summary>
          <ItemGroup className="gap-2 border-t p-3">
            {pendingRows.map((row) => (
              <RepoRow
                key={row.releaseId}
                owner={row.owner}
                name={row.name}
                iconUrl={row.iconUrl}
                tag={row.tag}
                description="Not summarized"
                meta={row.publishedAt ? formatRelative(row.publishedAt) : undefined}
              >
                <SummarizeReleaseButton releaseId={row.releaseId} owner={row.owner} name={row.name} tag={row.tag} />
              </RepoRow>
            ))}
          </ItemGroup>
        </details>
      )}
    </div>
  );
}

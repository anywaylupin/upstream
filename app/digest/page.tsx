import { eq, inArray } from 'drizzle-orm';
import { BellIcon, CalendarDaysIcon, SearchXIcon } from 'lucide-react';
import Link from 'next/link';
import { DigestFilters } from '@/components/digest-filters';
import { EmptyStack } from '@/components/empty-stack';
import { PageHeader } from '@/components/page-header';
import { RepoRow } from '@/components/repo-row';
import { SummarizeButton } from '@/components/summarize-button';
import { SummarizeReleaseButton } from '@/components/summarize-release-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ItemGroup } from '@/components/ui/item';
import { VerdictBadge } from '@/components/verdict-badge';
import { db } from '@/db';
import { repos, userInstructions } from '@/db/schema';
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

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

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
 * An empty stack and an over-tight filter are different problems, so only the first one offers the add-a-repo actions.
 */
export default async function Digest({
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
  for (const row of rows) {
    const { releaseId, tag, publishedAt, owner, name, data } = row;
    if (!publishedAt) continue;
    if (data === null) {
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

  const weeks = new Map<number, { label: string; entries: Entry[] }>();
  for (const entry of entries) {
    const weekStart = startOfWeek(entry.publishedAt);
    const key = weekStart.getTime();
    const bucket = weeks.get(key);
    if (bucket) bucket.entries.push(entry);
    else weeks.set(key, { label: formatWeekLabel(weekStart), entries: [entry] });
  }
  for (const week of weeks.values()) {
    week.entries.sort((a, b) => Number(b.relevant) - Number(a.relevant));
  }
  const sortedWeeks = [...weeks.entries()].sort(([a], [b]) => b - a);

  const pending = pendingRows.length;
  const breakingCount = entries.filter((entry) =>
    entry.summary.changes.some((change) => change.type === 'breaking')
  ).length;

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="Updates"
        description={
          <span className="flex items-center gap-2">
            {entries.length + pending} release{entries.length + pending === 1 ? '' : 's'} in the last {days} days
            {pending > 0 && entries.length > 0 && `, ${pending} waiting for a summary`}
            {breakingCount > 0 && <Badge variant="destructive">{breakingCount} breaking</Badge>}
          </span>
        }
        action={pending > 0 ? <SummarizeButton /> : undefined}
      />

      <DigestFilters
        repos={repoList.map((r) => `${r.owner}/${r.name}`)}
        selected={{ types, effort, repos: repoFilter, days, q }}
      />

      {sortedWeeks.length === 0 &&
        pending === 0 &&
        (repoIds.length === 0 ? (
          <EmptyStack icon={BellIcon} title="No releases yet" description="Add a repo to see its releases." />
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

      <div className="flex flex-col gap-8">
        {sortedWeeks.map(([key, week]) => (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
              <CalendarDaysIcon className="size-4 text-muted-foreground" />
              {week.label} · {week.entries.length}
            </h2>

            <div className="flex flex-col gap-3">
              {week.entries.map((entry, i) => {
                const hasBreaking = entry.summary.changes.some((change) => change.type === 'breaking');
                return (
                  <Card
                    key={entry.releaseId}
                    size="sm"
                    style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                    className={
                      hasBreaking
                        ? 'lift animate-rise ring-2 ring-destructive/50 hover:ring-destructive'
                        : 'lift animate-rise hover:ring-foreground/25'
                    }
                  >
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-baseline gap-2">
                        <Link href={`/repos/${entry.repo}`} className="hover:underline">
                          {entry.repo}
                        </Link>
                        <span className="font-mono font-normal text-muted-foreground text-xs">{entry.tag}</span>
                        {entry.relevant && <Badge variant="secondary">for you</Badge>}
                        <span className="ml-auto">
                          <VerdictBadge verdict={upgradeVerdict(entry.summary)} />
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
                );
              })}
            </div>
          </section>
        ))}

        {pending > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold text-lg tracking-tight">Not summarized · {pending}</h2>
            <ItemGroup className="animate-rise gap-2">
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
          </section>
        )}
      </div>
    </div>
  );
}

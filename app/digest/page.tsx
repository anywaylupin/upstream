import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { CalendarDaysIcon, SearchXIcon } from 'lucide-react';
import Link from 'next/link';
import { DigestFilters } from '@/components/digest-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { db } from '@/db';
import { releases, repos, stackRepos, summaries, userInstructions } from '@/db/schema';
import { CHANGE_TYPES, EFFORTS, WINDOWS } from '@/lib/digest-filters';
import { windowStart } from '@/lib/repo-stats';
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

  const watched = await db.select({ repoId: stackRepos.repoId }).from(stackRepos).where(eq(stackRepos.userId, user.id));
  const repoIds = watched.map((w) => w.repoId);

  const [rows, repoList, preferences] = await Promise.all([
    repoIds.length
      ? db
          .select({
            releaseId: releases.id,
            tag: releases.tag,
            publishedAt: releases.publishedAt,
            owner: repos.owner,
            name: repos.name,
            data: summaries.data
          })
          .from(releases)
          .innerJoin(repos, eq(repos.id, releases.repoId))
          .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
          .where(
            and(
              inArray(releases.repoId, repoIds),
              isNotNull(releases.publishedAt),
              gte(releases.publishedAt, windowStart(days))
            )
          )
          .orderBy(desc(releases.publishedAt))
      : Promise.resolve([]),
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

  // The digest highlights against the summary instruction, else the global one.
  const byFeature = new Map(preferences.map((row) => [row.feature, row.text]));
  const keywords = keywordsFrom(byFeature.get('summary') ?? byFeature.get('global') ?? '');

  const entries: Entry[] = [];
  for (const row of rows) {
    const { releaseId, tag, publishedAt, owner, name, data } = row;
    if (!publishedAt) continue;

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

  const breakingCount = entries.filter((entry) =>
    entry.summary.changes.some((change) => change.type === 'breaking')
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-muted-foreground text-sm tabular-nums">
          <span>{entries.length} releases</span>
          {breakingCount > 0 && <Badge variant="destructive">{breakingCount} breaking</Badge>}
          <span>{days}d</span>
        </p>
      </header>

      <DigestFilters
        repos={repoList.map((r) => `${r.owner}/${r.name}`)}
        selected={{ types, effort, repos: repoFilter, days, q }}
      />

      {sortedWeeks.length === 0 && (
        <Empty className="animate-rise rounded-lg ring-1 ring-foreground/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{repoIds.length === 0 ? 'Your stack is empty' : 'No matches'}</EmptyTitle>
            <EmptyDescription>
              {repoIds.length === 0 ? 'Add a repo and its releases show up here.' : 'Try widening the filters.'}
            </EmptyDescription>
          </EmptyHeader>
          {repoIds.length === 0 && (
            <EmptyContent>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/repositories" />}>
                Browse repos
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}

      <div className="flex flex-col gap-8">
        {sortedWeeks.map(([key, week]) => (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
              <CalendarDaysIcon className="size-3.5" />
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
                        : 'lift animate-rise hover:ring-primary/40'
                    }
                  >
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-baseline gap-2">
                        <Link
                          href={`/repos/${entry.repo}`}
                          className="transition-colors hover:text-primary hover:underline"
                        >
                          {entry.repo}
                        </Link>
                        <span className="font-mono font-normal text-muted-foreground text-xs">{entry.tag}</span>
                        {hasBreaking && <Badge variant="destructive">breaking</Badge>}
                        {entry.relevant && <Badge variant="secondary">for you</Badge>}
                        <span className="ml-auto font-normal text-muted-foreground text-xs">
                          {entry.summary.upgradeEffort} effort
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
      </div>
    </div>
  );
}

import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { ArrowRightIcon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { DashboardEmpty } from '@/components/dashboard-empty';
import { Landing } from '@/components/landing';
import { OwnerAvatar } from '@/components/owner-avatar';
import { PageHeader } from '@/components/page-header';
import { ScoreRing } from '@/components/score-ring';
import { SyncStackButton } from '@/components/sync-stack-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { VerdictBadge } from '@/components/verdict-badge';
import { db } from '@/db';
import { releases, repos, stackRepos, summaries } from '@/db/schema';
import { DEFAULT_INSTRUCTIONS_HASH } from '@/lib/ai';
import { upgradeVerdict } from '@/lib/digest-filters';
import { formatRelative } from '@/lib/format';
import { rateRepo } from '@/lib/repo-rating';
import { getRatingWeights, getStackStats, windowStart } from '@/lib/repo-stats';
import { ReleaseSummary } from '@/lib/summarize';

/** A section on the dashboard: a real h2 and an optional "see all" link. */
function Section({
  title,
  href,
  linkLabel,
  children
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-lg tracking-tight">{title}</h2>
        <Link
          href={href}
          className="group flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          {linkLabel}
          <ArrowRightIcon className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
      <Card className="gap-0 py-0">
        <ul className="divide-y divide-border">{children}</ul>
      </Card>
    </section>
  );
}

export default async function Dashboard() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <Landing />;

  const stack = await db.select({ repoId: stackRepos.repoId }).from(stackRepos).where(eq(stackRepos.userId, userId));
  const repoIds = stack.map((row) => row.repoId);

  if (repoIds.length === 0) return <DashboardEmpty />;

  const [{ rows, totals }, weights, latest] = await Promise.all([
    getStackStats(userId),
    getRatingWeights(userId),
    repoIds.length
      ? db
          .select({
            releaseId: releases.id,
            tag: releases.tag,
            owner: repos.owner,
            name: repos.name,
            data: summaries.data
          })
          .from(releases)
          .innerJoin(repos, eq(repos.id, releases.repoId))
          .leftJoin(
            summaries,
            and(eq(summaries.bodyHash, releases.bodyHash), eq(summaries.instructionsHash, DEFAULT_INSTRUCTIONS_HASH))
          )
          .where(
            and(
              inArray(releases.repoId, repoIds),
              isNotNull(releases.publishedAt),
              gte(releases.publishedAt, windowStart())
            )
          )
          .orderBy(desc(releases.publishedAt))
          .limit(5)
      : Promise.resolve([])
  ]);

  const lastSync = rows
    .map((row) => row.lastIngestedAt)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  // Only repos that actually need something. When nothing does, the title says so.
  const attention = rows
    .filter((row) => row.breaking30d > 0)
    .map((row) => ({ row, rating: rateRepo(row, weights) }))
    .sort((a, b) => b.row.breaking30d - a.row.breaking30d)
    .slice(0, 5);

  const breaking = totals.breaking30d;

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        title={
          breaking > 0 ? (
            <span className="flex items-center gap-2 text-destructive">
              <TriangleAlertIcon className="size-6" />
              {breaking} breaking change{breaking === 1 ? '' : 's'} this month
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <ShieldCheckIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
              All clear
            </span>
          )
        }
        description={`${totals.repos} repo${totals.repos === 1 ? '' : 's'} followed · ${totals.releases30d} release${
          totals.releases30d === 1 ? '' : 's'
        } this month · synced ${formatRelative(lastSync ?? null)}`}
        action={<SyncStackButton />}
      />

      {attention.length > 0 && (
        <Section title="Needs attention" href="/stack" linkLabel="All repos">
          {attention.map(({ row, rating }) => (
            <li key={row.repoId}>
              <Link
                href={`/repos/${row.owner}/${row.name}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <OwnerAvatar owner={row.owner} size={28} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-sm group-hover:underline">
                    {row.owner}/{row.name}
                  </span>
                  <span className="truncate text-muted-foreground text-sm">{row.description ?? 'No description'}</span>
                </span>
                <Badge variant="destructive">{row.breaking30d} breaking</Badge>
                <ScoreRing score={rating.overall} size={36} />
              </Link>
            </li>
          ))}
        </Section>
      )}

      {latest.length > 0 && (
        <Section title="Latest updates" href="/digest" linkLabel="All updates">
          {latest.map((row) => {
            const parsed = ReleaseSummary.safeParse(row.data);
            return (
              <li key={row.releaseId}>
                <Link
                  href={`/repos/${row.owner}/${row.name}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <OwnerAvatar owner={row.owner} size={28} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate font-medium text-sm group-hover:underline">
                        {row.owner}/{row.name}
                      </span>
                      <span className="shrink-0 font-mono text-muted-foreground text-xs">{row.tag}</span>
                    </span>
                    <span className="truncate text-muted-foreground text-sm">
                      {parsed.success ? parsed.data.headline : 'Waiting for a summary'}
                    </span>
                  </span>
                  {parsed.success && <VerdictBadge verdict={upgradeVerdict(parsed.data)} />}
                </Link>
              </li>
            );
          })}
        </Section>
      )}
    </div>
  );
}

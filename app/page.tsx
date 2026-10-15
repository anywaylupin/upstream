import { ArrowRightIcon, HourglassIcon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { DashboardEmpty } from '@/components/dashboard-empty';
import { Landing } from '@/components/landing';
import { PageHeader } from '@/components/page-header';
import { RepoRow } from '@/components/repo-row';
import { ScoreRing } from '@/components/score-ring';
import { SummarizeButton } from '@/components/summarize-button';
import { SummarizeReleaseButton } from '@/components/summarize-release-button';
import { SyncStackButton } from '@/components/sync-stack-button';
import { Badge } from '@/components/ui/badge';
import { ItemGroup } from '@/components/ui/item';
import { VerdictBadge } from '@/components/verdict-badge';
import { upgradeVerdict } from '@/lib/digest-filters';
import { formatRelative } from '@/lib/format';
import { rateRepo } from '@/lib/repo-rating';
import { getRatingWeights, getRecentReleases, getStackRepoIds, getStackStats, windowStart } from '@/lib/repo-stats';
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
      <ItemGroup className="gap-2">{children}</ItemGroup>
    </section>
  );
}

/**
 * The signed-in home.
 * The title states the one thing that matters now, in order: breaking changes, then releases nobody has summarized yet, then all clear.
 * "All clear" used to show over a backlog of unsummarized releases, which claimed a check that had never run.
 *
 * Latest updates shows one row per repo: a busy repo publishing three betas in a day used to take three of the five rows.
 */
export default async function Dashboard() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <Landing />;

  const repoIds = await getStackRepoIds(userId);

  if (repoIds.length === 0) return <DashboardEmpty />;

  const [{ rows, totals }, weights, recent] = await Promise.all([
    getStackStats(userId),
    getRatingWeights(userId),
    getRecentReleases(repoIds, windowStart(), 40)
  ]);

  const lastSync = rows
    .map((row) => row.lastIngestedAt)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const attention = rows
    .filter((row) => row.breaking30d > 0)
    .map((row) => ({ row, rating: rateRepo(row, weights) }))
    .sort((a, b) => b.row.breaking30d - a.row.breaking30d)
    .slice(0, 5);

  const byRepo = new Map<string, { release: (typeof recent)[number]; more: number }>();
  for (const release of recent) {
    const key = `${release.owner}/${release.name}`;
    const seen = byRepo.get(key);
    if (seen) seen.more += 1;
    else byRepo.set(key, { release, more: 0 });
  }
  const latest = [...byRepo.values()].slice(0, 5);

  const { breaking30d: breaking, pending30d: pending } = totals;

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        title={
          breaking > 0 ? (
            <span className="flex items-center gap-2 text-destructive">
              <TriangleAlertIcon className="size-6" />
              {breaking} breaking change{breaking === 1 ? '' : 's'} this month
            </span>
          ) : pending > 0 ? (
            <span className="flex items-center gap-2">
              <HourglassIcon className="size-6 text-muted-foreground" />
              {pending} release{pending === 1 ? '' : 's'} to summarize
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
        action={
          <>
            <SyncStackButton />
            {pending > 0 && <SummarizeButton />}
          </>
        }
      />

      {attention.length > 0 && (
        <Section title="Needs attention" href="/stack" linkLabel="All repos">
          {attention.map(({ row, rating }) => (
            <RepoRow
              key={row.repoId}
              owner={row.owner}
              name={row.name}
              iconUrl={row.iconUrl}
              description={row.description ?? 'No description'}
            >
              <Badge variant="destructive">{row.breaking30d} breaking</Badge>
              <ScoreRing score={rating.overall} size={36} />
            </RepoRow>
          ))}
        </Section>
      )}

      {latest.length > 0 && (
        <Section title="Latest updates" href="/digest" linkLabel="All updates">
          {latest.map(({ release, more }) => {
            const parsed = ReleaseSummary.safeParse(release.data);
            return (
              <RepoRow
                key={release.releaseId}
                owner={release.owner}
                name={release.name}
                iconUrl={release.iconUrl}
                tag={release.tag}
                description={parsed.success ? parsed.data.headline : 'Not summarized'}
                meta={more > 0 ? `+${more} more` : undefined}
              >
                {parsed.success ? (
                  <VerdictBadge verdict={upgradeVerdict(parsed.data)} />
                ) : (
                  <SummarizeReleaseButton
                    releaseId={release.releaseId}
                    owner={release.owner}
                    name={release.name}
                    tag={release.tag}
                  />
                )}
              </RepoRow>
            );
          })}
        </Section>
      )}
    </div>
  );
}

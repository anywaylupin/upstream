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
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
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

export default async function Dashboard() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <Landing />;

  const repoIds = await getStackRepoIds(userId);

  if (repoIds.length === 0) return <DashboardEmpty />;

  const [{ rows, totals }, weights, latest] = await Promise.all([
    getStackStats(userId),
    getRatingWeights(userId),
    getRecentReleases(repoIds, windowStart(), 5)
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
            <Item
              key={row.repoId}
              variant="outline"
              className="hover:bg-muted/50"
              render={<Link href={`/repos/${row.owner}/${row.name}`} />}
            >
              <ItemMedia>
                <OwnerAvatar owner={row.owner} icon={row.iconUrl} size={28} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">
                  {row.owner}/{row.name}
                </ItemTitle>
                <ItemDescription className="truncate">{row.description ?? 'No description'}</ItemDescription>
              </ItemContent>
              <Badge variant="destructive">{row.breaking30d} breaking</Badge>
              <ScoreRing score={rating.overall} size={36} />
            </Item>
          ))}
        </Section>
      )}

      {latest.length > 0 && (
        <Section title="Latest updates" href="/digest" linkLabel="All updates">
          {latest.map((row) => {
            const parsed = ReleaseSummary.safeParse(row.data);
            return (
              <Item
                key={row.releaseId}
                variant="outline"
                className="hover:bg-muted/50"
                render={<Link href={`/repos/${row.owner}/${row.name}`} />}
              >
                <ItemMedia>
                  <OwnerAvatar owner={row.owner} icon={row.iconUrl} size={28} />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    <span className="truncate">
                      {row.owner}/{row.name}
                    </span>
                    <span className="shrink-0 font-mono font-normal text-muted-foreground text-xs">{row.tag}</span>
                  </ItemTitle>
                  <ItemDescription className="truncate">
                    {parsed.success ? parsed.data.headline : 'Waiting for a summary'}
                  </ItemDescription>
                </ItemContent>
                {parsed.success && <VerdictBadge verdict={upgradeVerdict(parsed.data)} />}
              </Item>
            );
          })}
        </Section>
      )}
    </div>
  );
}

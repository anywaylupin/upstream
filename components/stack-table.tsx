import { PackageOpenIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyStack } from '@/components/empty-stack';
import { OwnerAvatar } from '@/components/owner-avatar';
import { RefreshRepoButton } from '@/components/refresh-repo-button';
import { ScoreRing } from '@/components/score-ring';
import { StackButton } from '@/components/stack-button';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/format';
import type { RepoGuide } from '@/lib/repo-guide';
import type { Weights } from '@/lib/repo-rating';
import { rateRepo } from '@/lib/repo-rating';

export type StackRow = {
  repoId: number;
  owner: string;
  name: string;
  description: string | null;
  stars: number | null;
  forks: number | null;
  watchers: number | null;
  openIssues: number | null;
  pushedAt: Date | null;
  archived: boolean | null;
  license: string | null;
  lastIngestedAt: Date | null;
  totalReleases: number;
  releases30d: number;
  breaking30d: number;
  lastRelease: Date | null;
  releases90d: number;
  summarized90d: number;
  breaking90d: number;
  guide: RepoGuide | null;
  /** Set when the repo is in the signed-in user's stack. */
  stackId?: number;
};

export function StackTable({
  rows,
  weights,
  showStackToggle = false,
  emptyTitle = 'Nothing here',
  emptyMessage
}: {
  rows: StackRow[];
  weights: Weights;
  showStackToggle?: boolean;
  emptyTitle?: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <EmptyStack icon={PackageOpenIcon} title={emptyTitle} description={emptyMessage} />;
  }

  return (
    <ul className="animate-rise divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
      {rows.map((row) => {
        const rating = rateRepo(row, weights);
        return (
          <li
            key={row.repoId}
            className="group relative flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
          >
            <OwnerAvatar owner={row.owner} size={32} />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {/* Stretched link: the whole row navigates, the buttons stay buttons. */}
              <Link
                href={`/repos/${row.owner}/${row.name}`}
                className="truncate font-medium text-sm after:absolute after:inset-0 group-hover:underline"
              >
                {row.owner}/{row.name}
              </Link>
              <span className="truncate text-muted-foreground text-sm">{row.description ?? 'No description'}</span>
            </div>

            {/* One tag, truncated: two could wrap and break the one-line rhythm. */}
            <div className="hidden w-40 xl:flex">
              {row.guide?.bestFor[0] && (
                <Badge variant="outline" className="max-w-full truncate">
                  {row.guide.bestFor[0]}
                </Badge>
              )}
            </div>

            <div className="hidden w-36 flex-col items-end text-sm sm:flex">
              <span className="tabular-nums">
                {row.releases30d} release{row.releases30d === 1 ? '' : 's'} this month
              </span>
              <span className="text-muted-foreground">
                {row.lastRelease ? `last ${formatRelative(row.lastRelease)}` : 'no releases yet'}
              </span>
            </div>

            {row.breaking30d > 0 && <Badge variant="destructive">{row.breaking30d} breaking</Badge>}

            <ScoreRing score={rating.overall} size={40} />

            <div className="relative z-10 flex items-center gap-1">
              <RefreshRepoButton repoId={row.repoId} />
              {showStackToggle && <StackButton owner={row.owner} name={row.name} repoId={row.repoId} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

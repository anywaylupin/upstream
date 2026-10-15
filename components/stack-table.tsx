import { PackageOpenIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyStack } from '@/components/empty-stack';
import { OwnerAvatar } from '@/components/owner-avatar';
import { RefreshRepoButton } from '@/components/refresh-repo-button';
import { ScoreRing } from '@/components/score-ring';
import { StackButton } from '@/components/stack-button';
import { Badge } from '@/components/ui/badge';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
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
  iconUrl: string | null;
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
    <ItemGroup className="animate-rise gap-2">
      {rows.map((row) => {
        const rating = rateRepo(row, weights);
        return (
          <Item key={row.repoId} variant="outline" className="relative hover:bg-muted/50">
            <ItemMedia>
              <OwnerAvatar owner={row.owner} icon={row.iconUrl} size={32} />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle>
                <Link
                  href={`/repos/${row.owner}/${row.name}`}
                  className="truncate after:absolute after:inset-0 hover:underline"
                >
                  {row.owner}/{row.name}
                </Link>
              </ItemTitle>
              <ItemDescription className="truncate">{row.description ?? 'No description'}</ItemDescription>
            </ItemContent>
            {row.guide?.bestFor[0] && (
              <Badge variant="outline" className="hidden max-w-40 truncate xl:inline-flex">
                {row.guide.bestFor[0]}
              </Badge>
            )}
            <ItemContent className="hidden flex-none items-end sm:flex">
              <ItemTitle className="tabular-nums">
                {row.releases30d} release{row.releases30d === 1 ? '' : 's'} this month
              </ItemTitle>
              <ItemDescription>
                {row.lastRelease ? `last ${formatRelative(row.lastRelease)}` : 'no releases yet'}
              </ItemDescription>
            </ItemContent>
            {row.breaking30d > 0 && <Badge variant="destructive">{row.breaking30d} breaking</Badge>}
            <ScoreRing score={rating.overall} size={40} />
            <ItemActions className="relative z-10">
              <RefreshRepoButton repoId={row.repoId} />
              {showStackToggle && <StackButton owner={row.owner} name={row.name} repoId={row.repoId} />}
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}

import { PackageOpenIcon, SparklesIcon } from 'lucide-react';
import { cn } from 'tailwind-variants';
import { EmptyStack } from '@/components/empty-stack';
import { RepoActions } from '@/components/repo-actions';
import { RepoRow } from '@/components/repo-row';
import { ScoreRing } from '@/components/score-ring';
import { Badge } from '@/components/ui/badge';
import { ItemGroup } from '@/components/ui/item';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
      {rows.map((row) => (
        <RepoRow
          key={row.repoId}
          owner={row.owner}
          name={row.name}
          iconUrl={row.iconUrl}
          description={row.description ?? 'No description'}
          meta={row.lastRelease ? formatRelative(row.lastRelease) : 'No releases'}
        >
          {row.breaking30d > 0 && <Badge variant="destructive">{row.breaking30d} breaking</Badge>}
          <Tooltip>
            <TooltipTrigger
              render={<span role="img" />}
              aria-label={row.guide ? 'AI guide ready' : 'No AI guide yet'}
              className="hidden sm:inline-flex"
            >
              <SparklesIcon className={cn('size-4', row.guide ? 'text-primary' : 'text-muted-foreground/40')} />
            </TooltipTrigger>
            <TooltipContent>{row.guide ? 'AI guide ready' : 'No guide yet. Explain it from the ⋯ menu'}</TooltipContent>
          </Tooltip>
          <ScoreRing score={rateRepo(row, weights).overall} size={36} />
          <RepoActions
            repoId={row.repoId}
            owner={row.owner}
            name={row.name}
            followed={row.stackId !== undefined || showStackToggle}
            hasGuide={row.guide !== null}
            inList
          />
        </RepoRow>
      ))}
    </ItemGroup>
  );
}

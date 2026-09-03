import { PackageOpenIcon } from 'lucide-react';
import Link from 'next/link';
import { ClickableRow } from '@/components/clickable-row';
import { EmptyStack } from '@/components/empty-stack';
import { OwnerAvatar } from '@/components/owner-avatar';
import { RatingBadge } from '@/components/rating-badge';
import { RefreshRepoButton } from '@/components/refresh-repo-button';
import { StackButton } from '@/components/stack-button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format';
import type { RepoGuide } from '@/lib/repo-guide';
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
  breaking90d: number;
  guide: RepoGuide | null;
  /** Set when the repo is in the signed-in user's stack. */
  stackId?: number;
};

export function StackTable({
  rows,
  showStackToggle = false,
  emptyTitle = 'Nothing here',
  emptyMessage
}: {
  rows: StackRow[];
  showStackToggle?: boolean;
  emptyTitle?: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <EmptyStack icon={PackageOpenIcon} title={emptyTitle} description={emptyMessage} />;
  }

  return (
    <div className="animate-rise overflow-hidden rounded-lg ring-1 ring-foreground/10">
      {/* table-fixed plus explicit widths: the repo name wraps in its column
          rather than widening the table into a horizontal scroll. */}
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[34%] sm:w-[24%]">Repo</TableHead>
            <TableHead className="w-20">Rating</TableHead>
            <TableHead className="hidden xl:table-cell">Best for</TableHead>
            <TableHead className="hidden w-16 text-right sm:table-cell">Total</TableHead>
            <TableHead className="w-14 text-right">30d</TableHead>
            <TableHead className="w-20 text-right">Breaking</TableHead>
            <TableHead className="hidden w-28 lg:table-cell">Latest</TableHead>
            <TableHead className="hidden w-28 lg:table-cell">Synced</TableHead>
            <TableHead className="w-28 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const rating = rateRepo(row);

            return (
              <ClickableRow key={row.repoId} href={`/repos/${row.owner}/${row.name}`}>
                <TableCell className="font-medium">
                  <span className="flex items-start gap-2">
                    <span className="mt-0.5">
                      <OwnerAvatar owner={row.owner} />
                    </span>
                    <Link
                      href={`/repos/${row.owner}/${row.name}`}
                      className="min-w-0 whitespace-normal break-words transition-colors hover:underline group-hover/row:text-primary"
                    >
                      {row.owner}/{row.name}
                    </Link>
                  </span>
                </TableCell>
                <TableCell>
                  <RatingBadge rating={rating} />
                </TableCell>
                <TableCell className="hidden overflow-hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {row.guide?.bestFor.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    )) ?? <span className="text-muted-foreground">-</span>}
                  </div>
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                  {row.totalReleases}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.releases30d}</TableCell>
                <TableCell className="text-right">
                  {row.breaking30d > 0 ? (
                    <Badge variant="destructive">{row.breaking30d}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="hidden truncate text-muted-foreground lg:table-cell">
                  {formatDate(row.lastRelease)}
                </TableCell>
                <TableCell className="hidden truncate text-muted-foreground lg:table-cell">
                  {formatRelative(row.lastIngestedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <RefreshRepoButton repoId={row.repoId} />
                    {showStackToggle && <StackButton owner={row.owner} name={row.name} repoId={row.repoId} />}
                  </div>
                </TableCell>
              </ClickableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

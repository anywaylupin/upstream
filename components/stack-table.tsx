import { PackageOpenIcon } from "lucide-react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { OwnerAvatar } from "@/components/owner-avatar";
import { RatingBadge } from "@/components/rating-badge";
import { RefreshRepoButton } from "@/components/refresh-repo-button";
import { StackButton } from "@/components/stack-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatRelative } from "@/lib/format";
import type { RepoGuide } from "@/lib/repo-guide";
import { rateRepo } from "@/lib/repo-rating";

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
  emptyMessage,
}: {
  rows: StackRow[];
  showStackToggle?: boolean;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="animate-rise flex flex-col items-center gap-2 rounded-lg py-12 text-sm text-muted-foreground ring-1 ring-foreground/10">
        <PackageOpenIcon className="size-6 opacity-60" />
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="animate-rise overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repo</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead className="hidden xl:table-cell">Best for</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">30d</TableHead>
            <TableHead className="text-right">Breaking</TableHead>
            <TableHead>Latest</TableHead>
            <TableHead>Synced</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const rating = rateRepo(row);

            return (
              <ClickableRow
                key={row.repoId}
                href={`/repos/${row.owner}/${row.name}`}
              >
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <OwnerAvatar owner={row.owner} />
                    <Link
                      href={`/repos/${row.owner}/${row.name}`}
                      className="transition-colors group-hover/row:text-primary hover:underline"
                    >
                      {row.owner}/{row.name}
                    </Link>
                  </span>
                </TableCell>
                <TableCell>
                  <RatingBadge rating={rating} />
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {row.guide?.bestFor.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    )) ?? <span className="text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.totalReleases}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.releases30d}
                </TableCell>
                <TableCell className="text-right">
                  {row.breaking30d > 0 ? (
                    <Badge variant="destructive">{row.breaking30d}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(row.lastRelease)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRelative(row.lastIngestedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <RefreshRepoButton repoId={row.repoId} />
                    {showStackToggle && (
                      <StackButton
                        owner={row.owner}
                        name={row.name}
                        repoId={row.repoId}
                      />
                    )}
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

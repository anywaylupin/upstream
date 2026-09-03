import { SearchIcon, StarIcon } from 'lucide-react';
import Link from 'next/link';
import { ClickableRow } from '@/components/clickable-row';
import { OwnerAvatar } from '@/components/owner-avatar';
import { StackButton } from '@/components/stack-button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { GitHubRepo } from '@/lib/github';

export function GitHubReposTable({
  repos,
  repoIdByFullName,
  emptyMessage
}: {
  repos: GitHubRepo[];
  /** full_name -> repos.id, for repos already in the stack. */
  repoIdByFullName: Map<string, number>;
  emptyMessage: string;
}) {
  if (repos.length === 0) {
    return (
      <Empty className="animate-rise rounded-lg ring-1 ring-foreground/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>No repos</EmptyTitle>
          <EmptyDescription>{emptyMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    // table-fixed plus explicit widths: the repo name wraps inside its column
    // instead of widening the table and forcing a horizontal scrollbar.
    <div className="animate-rise overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[38%] sm:w-[26%]">Repo</TableHead>
            <TableHead className="hidden lg:table-cell">About</TableHead>
            <TableHead className="hidden w-24 sm:table-cell">Lang</TableHead>
            <TableHead className="w-20 text-right">Stars</TableHead>
            <TableHead className="w-28 text-right">Stack</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {repos.map((repo) => (
            <ClickableRow key={repo.id} href={`/repos/${repo.owner.login}/${repo.name}`}>
              <TableCell className="font-medium">
                <span className="flex items-start gap-2">
                  <span className="mt-0.5">
                    <OwnerAvatar owner={repo.owner.login} />
                  </span>
                  {/* Repo names always lead to the Upstream page, never off-site. */}
                  <Link
                    href={`/repos/${repo.owner.login}/${repo.name}`}
                    className="min-w-0 whitespace-normal break-words transition-colors hover:underline group-hover/row:text-primary"
                  >
                    {repo.full_name}
                  </Link>
                </span>
              </TableCell>
              <TableCell className="hidden truncate text-muted-foreground lg:table-cell">
                {repo.description ?? '-'}
              </TableCell>
              <TableCell className="hidden truncate text-muted-foreground sm:table-cell">
                {repo.language ?? '-'}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="size-3" />
                  {repo.stargazers_count.toLocaleString()}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <StackButton owner={repo.owner.login} name={repo.name} repoId={repoIdByFullName.get(repo.full_name)} />
              </TableCell>
            </ClickableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import { SearchIcon, StarIcon } from 'lucide-react';
import Link from 'next/link';
import { OwnerAvatar } from '@/components/owner-avatar';
import { StackButton } from '@/components/stack-button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
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

  // Same one-line row as the Following list, so the two tabs read as one app.
  return (
    <ul className="animate-rise divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
      {repos.map((repo) => (
        <li
          key={repo.id}
          className="group relative flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
        >
          <OwnerAvatar owner={repo.owner.login} size={32} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link
              href={`/repos/${repo.full_name}`}
              className="truncate font-medium text-sm after:absolute after:inset-0 group-hover:underline"
            >
              {repo.full_name}
            </Link>
            <span className="truncate text-muted-foreground text-sm">{repo.description ?? 'No description'}</span>
          </div>
          {repo.language && (
            <span className="hidden w-24 truncate text-muted-foreground text-sm sm:block">{repo.language}</span>
          )}
          <span className="inline-flex w-16 items-center justify-end gap-1 text-muted-foreground text-sm tabular-nums">
            <StarIcon className="size-3.5" />
            {repo.stargazers_count.toLocaleString()}
          </span>
          <div className="relative z-10">
            <StackButton owner={repo.owner.login} name={repo.name} repoId={repoIdByFullName.get(repo.full_name)} />
          </div>
        </li>
      ))}
    </ul>
  );
}

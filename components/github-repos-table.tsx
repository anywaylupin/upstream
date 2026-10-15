import { SearchIcon, StarIcon } from 'lucide-react';
import Link from 'next/link';
import { OwnerAvatar } from '@/components/owner-avatar';
import { StackButton } from '@/components/stack-button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
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
      <Empty className="animate-rise border">
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
    <ItemGroup className="animate-rise gap-2">
      {repos.map((repo) => (
        <Item key={repo.id} variant="outline" className="relative hover:bg-muted/50">
          <ItemMedia>
            <OwnerAvatar owner={repo.owner.login} size={32} />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>
              <Link href={`/repos/${repo.full_name}`} className="truncate after:absolute after:inset-0 hover:underline">
                {repo.full_name}
              </Link>
            </ItemTitle>
            <ItemDescription className="truncate">{repo.description ?? 'No description'}</ItemDescription>
          </ItemContent>
          {repo.language && (
            <span className="hidden w-24 truncate text-muted-foreground text-sm sm:block">{repo.language}</span>
          )}
          <span className="inline-flex w-16 items-center justify-end gap-1 text-muted-foreground text-sm tabular-nums">
            <StarIcon className="size-3.5" />
            {repo.stargazers_count.toLocaleString()}
          </span>
          <ItemActions className="relative z-10">
            <StackButton owner={repo.owner.login} name={repo.name} repoId={repoIdByFullName.get(repo.full_name)} />
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}

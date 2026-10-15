import { SearchIcon, StarIcon } from 'lucide-react';
import { RepoRow } from '@/components/repo-row';
import { StackButton } from '@/components/stack-button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ItemGroup } from '@/components/ui/item';
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
        <RepoRow
          key={repo.id}
          owner={repo.owner.login}
          name={repo.name}
          description={repo.description ?? 'No description'}
          meta={
            <span className="inline-flex items-center gap-1">
              {repo.language && `${repo.language} · `}
              <StarIcon className="size-3.5" />
              {repo.stargazers_count.toLocaleString()}
            </span>
          }
        >
          <StackButton owner={repo.owner.login} name={repo.name} repoId={repoIdByFullName.get(repo.full_name)} />
        </RepoRow>
      ))}
    </ItemGroup>
  );
}

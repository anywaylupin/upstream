import { isNotNull } from 'drizzle-orm';
import { SearchIcon, StarIcon } from 'lucide-react';
import { RepoRow } from '@/components/repo-row';
import { StackButton } from '@/components/stack-button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ItemGroup } from '@/components/ui/item';
import { db } from '@/db';
import { repos } from '@/db/schema';
import type { GitHubRepo } from '@/lib/github';

/**
 * Repos straight from GitHub's lists, which carry no icon.
 * Any repo already in the catalogue reuses the homepage icon ingest stored; the rest keep the owner avatar, because reading every homepage live would make a 100-row tab wait on 100 sites.
 *
 * ponytail: it reads every stored icon in one query; scope it to these names if the catalogue grows past a few thousand repos.
 */
export async function GitHubReposTable({
  repos: list,
  repoIdByFullName,
  emptyMessage
}: {
  repos: GitHubRepo[];
  /** full_name -> repos.id, for repos already in the stack. */
  repoIdByFullName: Map<string, number>;
  emptyMessage: string;
}) {
  if (list.length === 0) {
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

  const known = await db
    .select({ owner: repos.owner, name: repos.name, iconUrl: repos.iconUrl })
    .from(repos)
    .where(isNotNull(repos.iconUrl));
  const iconByName = new Map(known.map((row) => [`${row.owner}/${row.name}`.toLowerCase(), row.iconUrl]));

  return (
    <ItemGroup className="animate-rise gap-2">
      {list.map((repo) => (
        <RepoRow
          key={repo.id}
          owner={repo.owner.login}
          name={repo.name}
          iconUrl={iconByName.get(repo.full_name.toLowerCase())}
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

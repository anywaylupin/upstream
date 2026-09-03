import { eq } from 'drizzle-orm';
import { SearchIcon, TriangleAlertIcon } from 'lucide-react';
import { GitHubReposTable } from '@/components/github-repos-table';
import { RepoSourceTabs } from '@/components/repo-source-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/db';
import { repos, stackRepos } from '@/db/schema';
import { type GitHubRepo, getGitHubToken, searchRepos } from '@/lib/github';
import { cachedOwnRepos, cachedStarredRepos, cachedWatchedRepos } from '@/lib/github-cache';
import { emptyMessageFor, type RepoSource, toRepoSource } from '@/lib/repo-sources';
import { requireUser } from '@/lib/session';

export default async function RepositoriesPage({
  searchParams
}: {
  searchParams: Promise<{ source?: string; q?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const source: RepoSource = toRepoSource(params.source);
  const q = params.q?.trim() ?? '';

  const stackRows = await db
    .select({ repoId: repos.id, owner: repos.owner, name: repos.name })
    .from(stackRepos)
    .innerJoin(repos, eq(repos.id, stackRepos.repoId))
    .where(eq(stackRepos.userId, user.id));

  const repoIdByFullName = new Map(stackRows.map((row) => [`${row.owner}/${row.name}`, row.repoId]));

  let results: GitHubRepo[] = [];
  let error: string | null = null;

  const token = await getGitHubToken(user.id);
  if (!token) {
    error = 'Your GitHub sign-in has expired. Sign out and back in to reconnect.';
  } else {
    try {
      // Cached per user, so switching tabs does not re-hit the API each time.
      if (source === 'owned') results = await cachedOwnRepos(user.id, token);
      else if (source === 'watched') {
        results = await cachedWatchedRepos(user.id, token);
      } else if (source === 'starred') results = await cachedStarredRepos(user.id, token);
      // Search is a different query every time; caching it would only bloat.
      else if (q) results = await searchRepos(token, q);
    } catch (err) {
      console.error(`GitHub lookup failed for ${source}:`, err);
      error = err instanceof Error ? err.message : 'Lookup failed';
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          Read-only views of your GitHub account. Add any of them to your stack.
        </p>
      </header>

      <RepoSourceTabs active={source} />

      {source === 'search' && (
        <form action="/repositories" method="get" className="flex items-center gap-2">
          <input type="hidden" name="source" value="search" />
          <Input
            id="repo-search"
            name="q"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            defaultValue={q}
            placeholder="react query, orm, testing"
            className="max-w-md"
            aria-label="Search GitHub"
          />
          <Button type="submit" variant="outline" size="sm" className="group">
            <SearchIcon data-icon="inline-start" className="transition-transform duration-200 group-hover:scale-110" />
            Search
          </Button>
        </form>
      )}

      {error && (
        <p className="flex items-center gap-2 rounded-lg p-3 text-destructive text-sm ring-1 ring-destructive/30">
          <TriangleAlertIcon className="size-4 shrink-0" />
          GitHub: {error}
        </p>
      )}

      <GitHubReposTable
        repos={results}
        repoIdByFullName={repoIdByFullName}
        emptyMessage={source === 'search' && q ? 'No matches.' : emptyMessageFor(source)}
      />
    </div>
  );
}

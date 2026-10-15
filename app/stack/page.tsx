import { eq } from 'drizzle-orm';
import { SearchIcon, SlidersHorizontalIcon, TriangleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import { GitHubReposTable } from '@/components/github-repos-table';
import { PageHeader } from '@/components/page-header';
import { RepoSourceTabs } from '@/components/repo-source-tabs';
import { StackTable } from '@/components/stack-table';
import { SyncStackButton } from '@/components/sync-stack-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/db';
import { repos, stackRepos } from '@/db/schema';
import { type GitHubRepo, getGitHubToken, searchRepos } from '@/lib/github';
import { cachedOwnRepos, cachedStarredRepos, cachedWatchedRepos } from '@/lib/github-cache';
import { emptyMessageFor, type RepoSource, toRepoSource } from '@/lib/repo-sources';
import { getRatingWeights, getStackStats } from '@/lib/repo-stats';
import { requireUser } from '@/lib/session';

/**
 * Library: the repos you follow and every way to follow more, on one page.
 * It replaced three entry points (Following, Repositories, the search page) that all served one job.
 *
 * GitHub lists are cached per user, so switching tabs does not re-hit the API; search is a fresh query every time, so it is not cached.
 */
export default async function LibraryPage({
  searchParams
}: {
  searchParams: Promise<{ source?: string; q?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const source: RepoSource = toRepoSource(params.source);
  const q = params.q?.trim() ?? '';

  const [{ rows }, weights] = await Promise.all([getStackStats(user.id), getRatingWeights(user.id)]);

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="Library"
        description={`You follow ${rows.length} repo${rows.length === 1 ? '' : 's'}`}
        action={
          rows.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/settings?section=rating" />}
                nativeButton={false}
              >
                <SlidersHorizontalIcon data-icon="inline-start" />
                Edit rating
              </Button>
              <SyncStackButton />
            </>
          )
        }
      />
      <RepoSourceTabs active={source} />

      {source === 'following' ? (
        <StackTable
          rows={rows}
          weights={weights}
          showStackToggle
          emptyTitle="Not following anything yet"
          emptyMessage="Pick from your GitHub repos in the tabs above, or paste a repo URL with the + button."
        />
      ) : (
        <GitHubSource userId={user.id} source={source} q={q} />
      )}
    </div>
  );
}

async function GitHubSource({ userId, source, q }: { userId: string; source: RepoSource; q: string }) {
  const stackRows = await db
    .select({ repoId: repos.id, owner: repos.owner, name: repos.name })
    .from(stackRepos)
    .innerJoin(repos, eq(repos.id, stackRepos.repoId))
    .where(eq(stackRepos.userId, userId));
  const repoIdByFullName = new Map(stackRows.map((row) => [`${row.owner}/${row.name}`, row.repoId]));

  let results: GitHubRepo[] = [];
  let error: string | null = null;
  const token = await getGitHubToken(userId);
  if (!token) {
    error = 'Your GitHub sign-in has expired. Sign out and back in to reconnect.';
  } else {
    try {
      if (source === 'owned') results = await cachedOwnRepos(userId, token);
      else if (source === 'watched') results = await cachedWatchedRepos(userId, token);
      else if (source === 'starred') results = await cachedStarredRepos(userId, token);
      else if (q) results = await searchRepos(token, q);
    } catch (err) {
      console.error(`GitHub lookup failed for ${source}:`, err);
      error = err instanceof Error ? err.message : 'Lookup failed';
    }
  }

  return (
    <>
      {source === 'search' && (
        <form action="/stack" method="get" className="flex items-center gap-2">
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
          <Button type="submit" variant="outline" size="sm">
            <SearchIcon data-icon="inline-start" />
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
    </>
  );
}

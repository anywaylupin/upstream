import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { LayersIcon, SearchIcon, SearchXIcon, TagIcon } from 'lucide-react';
import { GitHubReposTable } from '@/components/github-repos-table';
import { PageHeader } from '@/components/page-header';
import { RepoRow } from '@/components/repo-row';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { ItemGroup } from '@/components/ui/item';
import { VerdictBadge } from '@/components/verdict-badge';
import { db } from '@/db';
import { releases, repos, stackRepos, summaries } from '@/db/schema';
import { upgradeVerdict } from '@/lib/digest-filters';
import { formatDate } from '@/lib/format';
import { type GitHubRepo, getGitHubToken, searchRepos } from '@/lib/github';
import { requireUser } from '@/lib/session';
import { ReleaseSummary } from '@/lib/summarize';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = (await searchParams).q?.trim() ?? '';
  const needle = q.toLowerCase();

  const stackRows = await db
    .select({
      repoId: repos.id,
      owner: repos.owner,
      name: repos.name,
      description: repos.description,
      iconUrl: repos.iconUrl
    })
    .from(stackRepos)
    .innerJoin(repos, eq(repos.id, stackRepos.repoId))
    .where(eq(stackRepos.userId, user.id));

  const repoIdByFullName = new Map(stackRows.map((row) => [`${row.owner}/${row.name}`, row.repoId]));
  const repoIds = stackRows.map((row) => row.repoId);

  const matchedRepos = needle
    ? stackRows.filter((row) => `${row.owner}/${row.name} ${row.description ?? ''}`.toLowerCase().includes(needle))
    : [];

  const releaseRows =
    needle && repoIds.length
      ? await db
          .select({
            releaseId: releases.id,
            tag: releases.tag,
            publishedAt: releases.publishedAt,
            owner: repos.owner,
            name: repos.name,
            iconUrl: repos.iconUrl,
            data: summaries.data
          })
          .from(releases)
          .innerJoin(repos, eq(repos.id, releases.repoId))
          .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
          .where(and(inArray(releases.repoId, repoIds), isNotNull(releases.publishedAt)))
          .orderBy(desc(releases.publishedAt))
          .limit(300)
      : [];

  const matchedReleases = releaseRows
    .flatMap((row) => {
      const parsed = ReleaseSummary.safeParse(row.data);
      if (!parsed.success) return [];
      const haystack = [
        `${row.owner}/${row.name}`,
        row.tag,
        parsed.data.headline,
        ...parsed.data.changes.map((c) => c.description)
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return [];
      return [{ ...row, summary: parsed.data }];
    })
    .slice(0, 20);

  let githubResults: GitHubRepo[] = [];
  if (needle) {
    const token = (await getGitHubToken(user.id)) ?? process.env.GITHUB_TOKEN;
    if (token) {
      try {
        githubResults = (await searchRepos(token, q)).slice(0, 10);
      } catch (err) {
        console.error('GitHub search failed:', err);
      }
    }
  }

  const nothing = needle && matchedRepos.length === 0 && matchedReleases.length === 0 && githubResults.length === 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader title={q ? `Results for "${q}"` : 'Search'} description="Your repos, their releases, and GitHub." />
        <form action="/search" className="sm:hidden">
          <Input
            id="site-search"
            name="q"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            defaultValue={q}
            placeholder="Search repos and releases"
            aria-label="Search"
            className="max-w-md"
          />
        </form>
      </div>

      {nothing && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing matched</EmptyTitle>
            <EmptyDescription>Try another term.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {matchedRepos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
            <LayersIcon className="size-4 text-muted-foreground" />
            Following · {matchedRepos.length}
          </h2>
          <ItemGroup className="gap-2">
            {matchedRepos.map((row) => (
              <RepoRow
                key={row.repoId}
                owner={row.owner}
                name={row.name}
                iconUrl={row.iconUrl}
                description={row.description ?? 'No description'}
              />
            ))}
          </ItemGroup>
        </section>
      )}

      {matchedReleases.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
            <TagIcon className="size-4 text-muted-foreground" />
            Releases · {matchedReleases.length}
          </h2>
          <ItemGroup className="gap-2">
            {matchedReleases.map((row) => (
              <RepoRow
                key={row.releaseId}
                owner={row.owner}
                name={row.name}
                iconUrl={row.iconUrl}
                tag={row.tag}
                description={row.summary.headline}
                meta={formatDate(row.publishedAt)}
              >
                <VerdictBadge verdict={upgradeVerdict(row.summary)} />
              </RepoRow>
            ))}
          </ItemGroup>
        </section>
      )}

      {githubResults.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-lg tracking-tight">
            <SearchIcon className="size-4 text-muted-foreground" />
            On GitHub · {githubResults.length}
          </h2>
          <GitHubReposTable repos={githubResults} repoIdByFullName={repoIdByFullName} emptyMessage="No matches." />
        </section>
      )}
    </div>
  );
}

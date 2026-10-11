import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { LayersIcon, SearchIcon, SearchXIcon, TagIcon } from 'lucide-react';
import Link from 'next/link';
import { GitHubReposTable } from '@/components/github-repos-table';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
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
      description: repos.description
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
      <header className="flex flex-col gap-3">
        <form action="/search">
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
      </header>

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
              <Item
                key={row.repoId}
                variant="outline"
                className="hover:bg-muted/50"
                render={<Link href={`/repos/${row.owner}/${row.name}`} />}
              >
                <ItemContent>
                  <ItemTitle>
                    {row.owner}/{row.name}
                  </ItemTitle>
                  <ItemDescription>{row.description ?? 'No description'}</ItemDescription>
                </ItemContent>
              </Item>
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
              <Item
                key={row.releaseId}
                variant="outline"
                className="hover:bg-muted/50"
                render={<Link href={`/repos/${row.owner}/${row.name}`} />}
              >
                <ItemContent>
                  <ItemTitle>
                    {row.owner}/{row.name}
                    <span className="font-mono font-normal text-muted-foreground text-xs">{row.tag}</span>
                  </ItemTitle>
                  <ItemDescription>{row.summary.headline}</ItemDescription>
                </ItemContent>
                <VerdictBadge verdict={upgradeVerdict(row.summary)} />
                <span className="text-muted-foreground text-sm">{formatDate(row.publishedAt)}</span>
              </Item>
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

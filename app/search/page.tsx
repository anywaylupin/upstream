import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { LayersIcon, SearchIcon, SearchXIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { GitHubReposTable } from "@/components/github-repos-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { releases, repos, stackRepos, summaries } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { type GitHubRepo, getGitHubToken, searchRepos } from "@/lib/github";
import { requireUser } from "@/lib/session";
import { ReleaseSummary } from "@/lib/summarize";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const q = (await searchParams).q?.trim() ?? "";
  const needle = q.toLowerCase();

  const stackRows = await db
    .select({
      repoId: repos.id,
      owner: repos.owner,
      name: repos.name,
      description: repos.description,
    })
    .from(stackRepos)
    .innerJoin(repos, eq(repos.id, stackRepos.repoId))
    .where(eq(stackRepos.userId, user.id));

  const repoIdByFullName = new Map(
    stackRows.map((row) => [`${row.owner}/${row.name}`, row.repoId]),
  );
  const repoIds = stackRows.map((row) => row.repoId);

  const matchedRepos = needle
    ? stackRows.filter((row) =>
        `${row.owner}/${row.name} ${row.description ?? ""}`
          .toLowerCase()
          .includes(needle),
      )
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
            data: summaries.data,
          })
          .from(releases)
          .innerJoin(repos, eq(repos.id, releases.repoId))
          .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
          .where(
            and(
              inArray(releases.repoId, repoIds),
              isNotNull(releases.publishedAt),
            ),
          )
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
        ...parsed.data.changes.map((c) => c.description),
      ]
        .join(" ")
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
        console.error("GitHub search failed:", err);
      }
    }
  }

  const nothing =
    needle &&
    matchedRepos.length === 0 &&
    matchedReleases.length === 0 &&
    githubResults.length === 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-3">
        <form action="/search">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search repos and releases"
            aria-label="Search"
            className="max-w-md"
          />
        </form>
      </header>

      {nothing && (
        <div className="flex flex-col items-center gap-2 rounded-lg py-12 text-sm text-muted-foreground ring-1 ring-foreground/10">
          <SearchXIcon className="size-6 opacity-60" />
          Nothing matched.
        </div>
      )}

      {matchedRepos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            <LayersIcon className="size-3.5" />
            In your stack · {matchedRepos.length}
          </h2>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg ring-1 ring-foreground/10">
            {matchedRepos.map((row) => (
              <li key={row.repoId}>
                <Link
                  href={`/repos/${row.owner}/${row.name}`}
                  className="flex flex-col gap-0.5 px-3 py-2.5 transition-colors hover:bg-muted"
                >
                  <span className="text-sm font-medium">
                    {row.owner}/{row.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {row.description ?? "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {matchedReleases.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            <TagIcon className="size-3.5" />
            Releases · {matchedReleases.length}
          </h2>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg ring-1 ring-foreground/10">
            {matchedReleases.map((row) => (
              <li
                key={row.releaseId}
                className="flex flex-col gap-1 px-3 py-2.5 transition-colors hover:bg-muted"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link
                    href={`/repos/${row.owner}/${row.name}`}
                    className="text-sm font-medium transition-colors hover:text-primary hover:underline"
                  >
                    {row.owner}/{row.name}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.tag}
                  </span>
                  {row.summary.changes.some((c) => c.type === "breaking") && (
                    <Badge variant="destructive">breaking</Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDate(row.publishedAt)}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {row.summary.headline}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {githubResults.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            <SearchIcon className="size-3.5" />
            On GitHub · {githubResults.length}
          </h2>
          <GitHubReposTable
            repos={githubResults}
            repoIdByFullName={repoIdByFullName}
            emptyMessage="No matches."
          />
        </section>
      )}
    </div>
  );
}

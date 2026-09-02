import { eq } from "drizzle-orm";
import {
  EyeIcon,
  SearchIcon,
  StarIcon,
  TriangleAlertIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { GitHubReposTable } from "@/components/github-repos-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { repos, stackRepos } from "@/db/schema";
import {
  type GitHubRepo,
  getGitHubToken,
  listGitHubWatchedRepos,
  listOwnRepos,
  listStarredRepos,
  searchRepos,
} from "@/lib/github";
import { requireUser } from "@/lib/session";

const SOURCES = [
  { id: "owned", label: "Owned", icon: UserIcon },
  { id: "watched", label: "Watched", icon: EyeIcon },
  { id: "starred", label: "Starred", icon: StarIcon },
  { id: "search", label: "Search", icon: SearchIcon },
] as const;

type Source = (typeof SOURCES)[number]["id"];

const EMPTY: Record<Source, string> = {
  owned: "No public repos on your account.",
  watched: "You aren't watching anything on GitHub.",
  starred: "You haven't starred anything.",
  search: "Search GitHub for a repo.",
};

export default async function RepositoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; q?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const source: Source =
    SOURCES.find((s) => s.id === params.source)?.id ?? "owned";
  const q = params.q?.trim() ?? "";

  const stackRows = await db
    .select({ repoId: repos.id, owner: repos.owner, name: repos.name })
    .from(stackRepos)
    .innerJoin(repos, eq(repos.id, stackRepos.repoId))
    .where(eq(stackRepos.userId, user.id));

  const repoIdByFullName = new Map(
    stackRows.map((row) => [`${row.owner}/${row.name}`, row.repoId]),
  );

  let results: GitHubRepo[] = [];
  let error: string | null = null;

  const token = (await getGitHubToken(user.id)) ?? process.env.GITHUB_TOKEN;
  if (!token) error = "No GitHub token.";
  else {
    try {
      if (source === "owned") results = await listOwnRepos(token);
      else if (source === "watched") {
        results = await listGitHubWatchedRepos(token);
      } else if (source === "starred") results = await listStarredRepos(token);
      else if (q) results = await searchRepos(token, q);
    } catch (err) {
      console.error(`GitHub lookup failed for ${source}:`, err);
      error = err instanceof Error ? err.message : "Lookup failed";
    }
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          Read-only views of your GitHub account. Add any of them to your stack.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {SOURCES.map((option) => {
          const active = option.id === source;
          return (
            <Link
              key={option.id}
              href={`/repositories?source=${option.id}`}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "-mb-px flex items-center gap-1.5 border-b-2 border-primary px-3 py-2 text-sm font-semibold"
                  : "-mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              }
            >
              <option.icon className="size-4" />
              {option.label}
            </Link>
          );
        })}
      </div>

      {source === "search" && (
        <form action="/repositories" className="flex items-center gap-2">
          <input type="hidden" name="source" value="search" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="react query, orm, testing…"
            className="max-w-md"
            aria-label="Search GitHub"
          />
          <Button type="submit" variant="outline" size="sm" className="group">
            <SearchIcon
              data-icon="inline-start"
              className="transition-transform duration-200 group-hover:scale-110"
            />
            Search
          </Button>
        </form>
      )}

      {error && (
        <p className="flex items-center gap-2 rounded-lg p-3 text-sm text-destructive ring-1 ring-destructive/30">
          <TriangleAlertIcon className="size-4 shrink-0" />
          GitHub: {error}
        </p>
      )}

      <GitHubReposTable
        repos={results}
        repoIdByFullName={repoIdByFullName}
        emptyMessage={source === "search" && q ? "No matches." : EMPTY[source]}
      />
    </div>
  );
}

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts } from "@/db/schema";

export const GitHubRepoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  owner: z.object({ login: z.string() }),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  html_url: z.string(),
  language: z.string().nullable(),
  pushed_at: z.string().nullable(),
  forks_count: z.number().default(0),
  open_issues_count: z.number().default(0),
  // Only returned by the single-repo endpoint, not by list endpoints.
  subscribers_count: z.number().optional(),
  license: z
    .object({ spdx_id: z.string().nullable() })
    .nullable()
    .default(null),
  archived: z.boolean().default(false),
  fork: z.boolean().default(false),
  private: z.boolean().default(false),
});

export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

const RepoListSchema = z.array(GitHubRepoSchema);
const SearchResultSchema = z.object({ items: RepoListSchema });

/** The OAuth token GitHub handed us at sign-in, stored by the Auth.js adapter. */
export async function getGitHubToken(userId: string) {
  const [account] = await db
    .select({ accessToken: accounts.access_token })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")));

  return account?.accessToken ?? null;
}

async function githubFetch(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "upstream",
    },
    cache: "no-store",
  });

  console.log(
    `GET ${path} -> ${res.status}, ratelimit-remaining: ${res.headers.get("x-ratelimit-remaining")}`,
  );

  if (!res.ok) {
    throw new Error(`GitHub API ${path}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/** Repos the signed-in user owns. Private repos need the `repo` scope, which we don't request. */
export async function listOwnRepos(token: string) {
  const json = await githubFetch(
    "/user/repos?type=owner&sort=updated&per_page=100",
    token,
  );
  return RepoListSchema.parse(json);
}

/** Repos the signed-in user watches on GitHub itself. */
export async function listGitHubWatchedRepos(token: string) {
  const json = await githubFetch("/user/subscriptions?per_page=100", token);
  return RepoListSchema.parse(json);
}

/** Repos the signed-in user has starred. */
export async function listStarredRepos(token: string) {
  const json = await githubFetch("/user/starred?per_page=100", token);
  return RepoListSchema.parse(json);
}

export async function searchRepos(token: string, query: string) {
  const json = await githubFetch(
    `/search/repositories?q=${encodeURIComponent(query)}&per_page=30`,
    token,
  );
  return SearchResultSchema.parse(json).items;
}

export async function getRepoMeta(owner: string, name: string, token: string) {
  const json = await githubFetch(`/repos/${owner}/${name}`, token);
  return GitHubRepoSchema.parse(json);
}

/** Raw README markdown, or null when the repo has none. */
export async function getReadme(owner: string, name: string, token: string) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${name}/readme`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "upstream",
      },
      cache: "no-store",
    },
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `GitHub API readme for ${owner}/${name}: ${res.status} ${res.statusText}`,
    );
  }

  return res.text();
}

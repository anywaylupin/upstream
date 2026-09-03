import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { accounts } from '@/db/schema';

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
  license: z.object({ spdx_id: z.string().nullable() }).nullable().default(null),
  archived: z.boolean().default(false),
  fork: z.boolean().default(false),
  private: z.boolean().default(false)
});

export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

const RepoListSchema = z.array(GitHubRepoSchema);
const SearchResultSchema = z.object({ items: RepoListSchema });

const RefreshResponse = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  refresh_token_expires_in: z.number().optional()
});

/**
 * GitHub OAuth apps can be configured to expire access tokens (ours are 8h).
 * Auth.js stores the refresh token but never spends it, so without this every
 * user-scoped call starts 401ing a few hours after sign-in.
 */
async function refreshGitHubToken(userId: string, refreshToken: string) {
  const clientId = process.env.AUTH_GITHUB_ID;
  const clientSecret = process.env.AUTH_GITHUB_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }),
    cache: 'no-store'
  });

  if (!res.ok) {
    console.error(`GitHub token refresh failed: ${res.status}`);
    return null;
  }

  const parsed = RefreshResponse.safeParse(await res.json());
  if (!parsed.success) {
    // GitHub answers 200 with {error: "bad_refresh_token"} when it is spent.
    console.error('GitHub token refresh rejected');
    return null;
  }

  const { access_token, expires_in, refresh_token } = parsed.data;
  await db
    .update(accounts)
    .set({
      access_token,
      refresh_token: refresh_token ?? refreshToken,
      expires_at: expires_in ? Math.floor(Date.now() / 1000) + expires_in : null
    })
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'github')));

  return access_token;
}

/**
 * The user's GitHub token, refreshed when it has expired. Null means the user
 * has to sign in again - callers should say so rather than fall back to the
 * server PAT, which belongs to a different account entirely.
 */
export async function getGitHubToken(userId: string) {
  const [account] = await db
    .select({
      accessToken: accounts.access_token,
      refreshToken: accounts.refresh_token,
      expiresAt: accounts.expires_at
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'github')));

  if (!account?.accessToken) return null;

  // 60s of slack so a token does not die mid-request.
  const expired = account.expiresAt !== null && account.expiresAt * 1000 < Date.now() + 60_000;

  if (expired && account.refreshToken) {
    return refreshGitHubToken(userId, account.refreshToken);
  }

  return account.accessToken;
}

async function githubFetch(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'upstream'
    },
    cache: 'no-store'
  });

  console.log(`GET ${path} -> ${res.status}, ratelimit-remaining: ${res.headers.get('x-ratelimit-remaining')}`);

  if (!res.ok) {
    throw new Error(`GitHub API ${path}: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/** Repos the signed-in user owns. Private repos need the `repo` scope, which we don't request. */
export async function listOwnRepos(token: string) {
  const json = await githubFetch('/user/repos?type=owner&sort=updated&per_page=100', token);
  return RepoListSchema.parse(json);
}

/** Repos the signed-in user watches on GitHub itself. */
export async function listGitHubWatchedRepos(token: string) {
  const json = await githubFetch('/user/subscriptions?per_page=100', token);
  return RepoListSchema.parse(json);
}

/** Repos the signed-in user has starred. */
export async function listStarredRepos(token: string) {
  const json = await githubFetch('/user/starred?per_page=100', token);
  return RepoListSchema.parse(json);
}

export async function searchRepos(token: string, query: string) {
  const json = await githubFetch(`/search/repositories?q=${encodeURIComponent(query)}&per_page=30`, token);
  return SearchResultSchema.parse(json).items;
}

const GitHubUserSchema = z.object({
  login: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  avatar_url: z.string(),
  html_url: z.string(),
  bio: z.string().nullable(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  public_repos: z.number().default(0),
  followers: z.number().default(0),
  following: z.number().default(0),
  created_at: z.string()
});

export type GitHubUser = z.infer<typeof GitHubUserSchema>;

/** The signed-in user's own GitHub profile. */
export async function getGitHubUser(token: string) {
  return GitHubUserSchema.parse(await githubFetch('/user', token));
}

/**
 * GitHub only returns `email` on /user when it is public, so fall back to the
 * verified primary from /user/emails when the scope allows it.
 */
export async function getPrimaryEmail(token: string) {
  const res = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'upstream'
    },
    cache: 'no-store'
  });
  if (!res.ok) return null;

  const parsed = z
    .array(
      z.object({
        email: z.string(),
        primary: z.boolean(),
        verified: z.boolean()
      })
    )
    .safeParse(await res.json());
  if (!parsed.success) return null;

  return parsed.data.find((row) => row.primary && row.verified)?.email ?? null;
}

export async function getRepoMeta(owner: string, name: string, token: string) {
  const json = await githubFetch(`/repos/${owner}/${name}`, token);
  return GitHubRepoSchema.parse(json);
}

/** Raw README markdown, or null when the repo has none. */
export async function getReadme(owner: string, name: string, token: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}/readme`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'upstream'
    },
    cache: 'no-store'
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub API readme for ${owner}/${name}: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

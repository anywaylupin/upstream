import { revalidateTag, unstable_cache } from 'next/cache';
import {
  type GitHubRepo,
  getGitHubUser,
  getPrimaryEmail,
  listGitHubWatchedRepos,
  listOwnRepos,
  listStarredRepos
} from '@/lib/github';

/**
 * Cross-request caching for the user-scoped GitHub reads.
 *
 * Without this, every `?source=` tab and every settings visit re-hit the API,
 * so the page sat on a skeleton for a second each time to fetch a list that had
 * not changed. React's `cache()` does not help here - it only dedupes within a
 * single request.
 *
 * The access token is deliberately NOT part of the cache key. It rotates every
 * eight hours, and keying on it would miss the cache on every refresh while
 * writing short-lived credentials into cache keys. The identity that matters is
 * the user, so that is what the key parts carry.
 *
 * `unstable_cache` is the deprecated API in Next 16; the replacement, `use
 * cache`, requires turning on Cache Components, which changes prerendering for
 * the whole app. Not worth it for five calls.
 */
const TTL_SECONDS = 300;

export function githubTag(userId: string) {
  return `github:${userId}`;
}

/**
 * Drops every cached GitHub read for one user. Next 16 wants a revalidation
 * profile alongside the tag; "max" is the recommended default.
 */
export async function refreshGitHubCache(userId: string) {
  revalidateTag(githubTag(userId), 'max');
}

function cached<T>(userId: string, name: string, load: () => Promise<T>) {
  return unstable_cache(load, ['github', name, userId], {
    revalidate: TTL_SECONDS,
    tags: [githubTag(userId)]
  })();
}

export function cachedOwnRepos(userId: string, token: string): Promise<GitHubRepo[]> {
  return cached(userId, 'owned', () => listOwnRepos(token));
}

export function cachedWatchedRepos(userId: string, token: string): Promise<GitHubRepo[]> {
  return cached(userId, 'watched', () => listGitHubWatchedRepos(token));
}

export function cachedStarredRepos(userId: string, token: string): Promise<GitHubRepo[]> {
  return cached(userId, 'starred', () => listStarredRepos(token));
}

export function cachedGitHubUser(userId: string, token: string) {
  return cached(userId, 'user', () => getGitHubUser(token));
}

export function cachedPrimaryEmail(userId: string, token: string) {
  return cached(userId, 'email', () => getPrimaryEmail(token));
}

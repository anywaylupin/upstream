import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { releases as releasesTable, repos as reposTable } from '@/db/schema';
import { getRepoMeta } from '@/lib/github';

type GitHubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
};

async function fetchReleases(owner: string, name: string): Promise<GitHubRelease[]> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');

  const url = `https://api.github.com/repos/${owner}/${name}/releases?per_page=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'upstream-ingest'
    }
  });

  // TODO: log res.headers.get("x-ratelimit-remaining")

  if (!res.ok) {
    throw new Error(`GitHub API error for ${owner}/${name}: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as GitHubRelease[];
}

function toRow(repoId: number, release: GitHubRelease) {
  const bodyHash = release.body ? createHash('sha256').update(release.body).digest('hex') : null;

  return {
    repoId,
    githubReleaseId: release.id,
    tag: release.tag_name,
    publishedAt: release.published_at ? new Date(release.published_at) : null,
    bodyRaw: release.body,
    bodyHash
  };
}

export async function ingestRepo(repo: { id: number; owner: string; name: string }) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');

  const fetched = await fetchReleases(repo.owner, repo.name);
  const rows = fetched.filter((r) => !r.draft).map((r) => toRow(repo.id, r));

  const inserted =
    rows.length === 0
      ? []
      : await db.insert(releasesTable).values(rows).onConflictDoNothing().returning({ id: releasesTable.id });

  // Refresh the card metadata and stamp the run, so the dashboard can show
  // what a repo is and when it was last checked.
  const meta = await getRepoMeta(repo.owner, repo.name, GITHUB_TOKEN).catch((err: unknown) => {
    console.error(`metadata refresh failed for ${repo.owner}/${repo.name}:`, err);
    return null;
  });

  await db
    .update(reposTable)
    .set({
      lastIngestedAt: new Date(),
      ...(meta
        ? {
            description: meta.description,
            stars: meta.stargazers_count,
            forks: meta.forks_count,
            watchers: meta.subscribers_count ?? null,
            openIssues: meta.open_issues_count,
            pushedAt: meta.pushed_at ? new Date(meta.pushed_at) : null,
            archived: meta.archived,
            license: meta.license?.spdx_id ?? null
          }
        : {})
    })
    .where(eq(reposTable.id, repo.id));

  return { fetched: rows.length, inserted: inserted.length };
}

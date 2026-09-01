import "dotenv/config";
import { createHash } from "node:crypto";
import { db } from "../db";
import { releases as releasesTable, repos } from "../db/schema";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set");

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

async function fetchReleases(
  owner: string,
  name: string,
): Promise<GitHubRelease[]> {
  const url = `https://api.github.com/repos/${owner}/${name}/releases?per_page=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "upstream-ingest",
    },
  });

  // TODO: log res.headers.get("x-ratelimit-remaining")
  // TODO: throw a useful error on !res.ok — include status and repo name

  return (await res.json()) as GitHubRelease[];
}

function toRow(repoId: number, release: GitHubRelease) {
  const bodyHash = release.body
    ? createHash("sha256").update(release.body).digest("hex")
    : null;

  return {
    repoId,
    githubReleaseId: release.id,
    tag: release.tag_name,
    publishedAt: release.published_at ? new Date(release.published_at) : null,
    bodyRaw: release.body,
    bodyHash,
  };
}

async function main() {
  const allRepos = await db.select().from(repos);
  console.log(`Ingesting ${allRepos.length} repos`);

  for (const repo of allRepos) {
    try {
      const fetched = await fetchReleases(repo.owner, repo.name);
      const rows = fetched
        .filter((r) => !r.draft)
        .map((r) => toRow(repo.id, r));

      if (rows.length === 0) {
        console.log(`${repo.owner}/${repo.name}: no releases`);
        continue;
      }

      const inserted = await db
        .insert(releasesTable)
        .values(rows)
        .onConflictDoNothing()
        .returning({ id: releasesTable.id });

      console.log(
        `${repo.owner}/${repo.name}: ${rows.length} fetched, ${inserted.length} new`,
      );
    } catch (err) {
      console.error(`${repo.owner}/${repo.name} failed:`, err);
      // continue to the next repo — one bad repo shouldn't kill the run
    }
  }

  console.log("Done");
}

main();

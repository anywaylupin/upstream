import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db";
import { releases, repos, summaries } from "../db/schema";
import { MODEL, PROMPT_VERSION, summarizeRelease } from "../lib/summarize";

const BATCH = 10;

async function main() {
  const pending = await db
    .select({
      bodyHash: releases.bodyHash,
      bodyRaw: releases.bodyRaw,
      tag: releases.tag,
      owner: repos.owner,
      name: repos.name,
    })
    .from(releases)
    .innerJoin(repos, eq(repos.id, releases.repoId))
    .leftJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
    .where(and(isNotNull(releases.bodyHash), isNull(summaries.id)))
    .limit(BATCH);

  console.log(`${pending.length} to summarize`);

  for (const row of pending) {
    const { bodyHash, bodyRaw } = row;
    if (!bodyHash || !bodyRaw) continue;

    try {
      const { output, usage } = await summarizeRelease({
        repo: `${row.owner}/${row.name}`,
        tag: row.tag,
        body: bodyRaw,
      });

      await db
        .insert(summaries)
        .values({
          bodyHash: bodyHash,
          model: MODEL,
          promptVersion: PROMPT_VERSION,
          data: output,
        })
        .onConflictDoNothing();

      console.log(
        `${row.owner}/${row.name} ${row.tag} — ${usage.totalTokens} tokens`,
      );
    } catch (err) {
      console.error(`${row.owner}/${row.name} ${row.tag} failed:`, err);
    }
  }
}

main();

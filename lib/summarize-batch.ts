import { and, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { releases, repos, summaries } from "@/db/schema";
import { MODEL, PROMPT_VERSION, summarizeRelease } from "@/lib/summarize";

export async function summarizePending({
  repoId,
  limit = 10,
}: {
  repoId?: number;
  limit?: number;
} = {}) {
  const conditions: SQL[] = [
    isNotNull(releases.bodyHash),
    isNull(summaries.id),
  ];
  if (repoId) conditions.push(eq(releases.repoId, repoId));

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
    .where(and(...conditions))
    .limit(limit);

  let summarized = 0;
  for (const row of pending) {
    const { bodyHash, bodyRaw, tag, owner, name } = row;
    if (!bodyHash || !bodyRaw) continue;

    try {
      const { output, usage } = await summarizeRelease({
        repo: `${owner}/${name}`,
        tag,
        body: bodyRaw,
      });

      await db
        .insert(summaries)
        .values({
          bodyHash,
          model: MODEL,
          promptVersion: PROMPT_VERSION,
          data: output,
        })
        .onConflictDoNothing();

      console.log(`${owner}/${name} ${tag} - ${usage.totalTokens} tokens`);
      summarized++;
    } catch (err) {
      console.error(`${owner}/${name} ${tag} failed:`, err);
    }
  }

  return { pending: pending.length, summarized };
}

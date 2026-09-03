import { and, eq, isNotNull, isNull, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { releases, repos, summaries } from '@/db/schema';
import type { AiContext } from '@/lib/ai';
import { PROMPT_VERSION, summarizeRelease } from '@/lib/summarize';

/** Small gap between calls: the free tier limits requests per minute. */
const CALL_SPACING_MS = 1_500;

export async function summarizePending(
  ai: AiContext,
  { repoId, limit = 10 }: { repoId?: number; limit?: number } = {}
) {
  const conditions: SQL[] = [isNotNull(releases.bodyHash), isNull(summaries.id)];
  if (repoId) conditions.push(eq(releases.repoId, repoId));

  const pending = await db
    .select({
      bodyHash: releases.bodyHash,
      bodyRaw: releases.bodyRaw,
      tag: releases.tag,
      owner: repos.owner,
      name: repos.name
    })
    .from(releases)
    .innerJoin(repos, eq(repos.id, releases.repoId))
    .leftJoin(
      summaries,
      and(eq(summaries.bodyHash, releases.bodyHash), eq(summaries.instructionsHash, ai.instructionsHash))
    )
    .where(and(...conditions))
    .limit(limit);

  let summarized = 0;
  for (const [index, row] of pending.entries()) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, CALL_SPACING_MS));
    }
    const { bodyHash, bodyRaw, tag, owner, name } = row;
    if (!bodyHash || !bodyRaw) continue;

    try {
      const { output, usage } = await summarizeRelease({ repo: `${owner}/${name}`, tag, body: bodyRaw }, ai);

      await db
        .insert(summaries)
        .values({
          bodyHash,
          instructionsHash: ai.instructionsHash,
          model: ai.modelId,
          promptVersion: PROMPT_VERSION,
          data: output
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

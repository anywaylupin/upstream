import { eq, inArray, ne, notInArray } from 'drizzle-orm';
import { db } from '@/db';
import { releases, repoGuides, repos, stackRepos, summaries, userInstructions, users } from '@/db/schema';
import { DEFAULT_INSTRUCTIONS_HASH, instructionsHash } from '@/lib/ai';

export type EraseReport = {
  personalisedSummaries: number;
  personalisedGuides: number;
  repos: number;
  releases: number;
  orphanedSummaries: number;
};

/**
 * Deletes everything attributable to one user.
 *
 * The foreign keys cascade the obvious rows (account, keys, instructions,
 * preferences, stack). Three things they cannot reach, and this handles:
 *
 *  1. AI output generated from the user's own instructions. Those rows are
 *     keyed by a hash of the instruction text rather than by user id, so a
 *     cascade never sees them.
 *  2. Repos nobody else keeps in a stack, plus their releases and guides.
 *     `releases.repo_id` is ON DELETE NO ACTION, so releases must go first.
 *  3. Summaries left referenced by no remaining release.
 *
 * The neon-http driver is stateless and has no interactive transactions, so
 * this runs as ordered statements. The order is chosen so a failure part-way
 * leaves orphaned cache rather than a broken foreign key.
 */
export async function eraseAccount(userId: string): Promise<EraseReport> {
  const report: EraseReport = {
    personalisedSummaries: 0,
    personalisedGuides: 0,
    repos: 0,
    releases: 0,
    orphanedSummaries: 0
  };

  // 1. Hashes of this user's own instructions, read before the cascade removes them.
  const instructionRows = await db
    .select({ text: userInstructions.text })
    .from(userInstructions)
    .where(eq(userInstructions.userId, userId));

  const hashes = [...new Set(instructionRows.map((row) => instructionsHash(row.text)))].filter(
    (hash) => hash !== DEFAULT_INSTRUCTIONS_HASH
  );

  if (hashes.length > 0) {
    const deletedSummaries = await db
      .delete(summaries)
      .where(inArray(summaries.instructionsHash, hashes))
      .returning({ id: summaries.id });
    report.personalisedSummaries = deletedSummaries.length;

    const deletedGuides = await db
      .delete(repoGuides)
      .where(inArray(repoGuides.instructionsHash, hashes))
      .returning({ id: repoGuides.id });
    report.personalisedGuides = deletedGuides.length;
  }

  // 2. Repos that only this user keeps, so removing them takes nothing from anyone.
  const mine = await db.select({ repoId: stackRepos.repoId }).from(stackRepos).where(eq(stackRepos.userId, userId));

  const others = await db.select({ repoId: stackRepos.repoId }).from(stackRepos).where(ne(stackRepos.userId, userId));

  const keptByOthers = new Set(others.map((row) => row.repoId));
  const orphaned = [...new Set(mine.map((row) => row.repoId))].filter((repoId) => !keptByOthers.has(repoId));

  if (orphaned.length > 0) {
    const deletedReleases = await db
      .delete(releases)
      .where(inArray(releases.repoId, orphaned))
      .returning({ id: releases.id });
    report.releases = deletedReleases.length;

    // Cascades repo_guides and stack_repos for these repos.
    const deletedRepos = await db.delete(repos).where(inArray(repos.id, orphaned)).returning({ id: repos.id });
    report.repos = deletedRepos.length;
  }

  // 3. Summaries no surviving release points at. They are a body-hash cache,
  //    so once the releases are gone nothing can ever read them again.
  const survivingHashes = await db.selectDistinct({ bodyHash: releases.bodyHash }).from(releases);

  const keep = survivingHashes.map((row) => row.bodyHash).filter((hash): hash is string => hash !== null);

  const orphanedSummaries = await db
    .delete(summaries)
    .where(keep.length > 0 ? notInArray(summaries.bodyHash, keep) : undefined)
    .returning({ id: summaries.id });
  report.orphanedSummaries = orphanedSummaries.length;

  // 4. The user itself, cascading account, keys, instructions, preferences, stack.
  await db.delete(users).where(eq(users.id, userId));

  return report;
}

/** Kept for the confirmation copy, so the dialog cannot drift from the code. */
export async function previewErase(userId: string) {
  const [stack, instructionRows] = await Promise.all([
    db.select({ repoId: stackRepos.repoId }).from(stackRepos).where(eq(stackRepos.userId, userId)),
    db.select({ id: userInstructions.id }).from(userInstructions).where(eq(userInstructions.userId, userId))
  ]);

  const others = await db.select({ repoId: stackRepos.repoId }).from(stackRepos).where(ne(stackRepos.userId, userId));
  const keptByOthers = new Set(others.map((row) => row.repoId));

  const orphaned = [...new Set(stack.map((row) => row.repoId))].filter((repoId) => !keptByOthers.has(repoId));

  const releaseRows = orphaned.length
    ? await db.select({ id: releases.id }).from(releases).where(inArray(releases.repoId, orphaned))
    : [];

  return {
    stack: stack.length,
    repos: orphaned.length,
    releases: releaseRows.length,
    instructions: instructionRows.length
  };
}

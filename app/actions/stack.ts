'use server';

import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { releases, repoGuides, repos, stackRepos } from '@/db/schema';
import { type ActionResult, errorMessage } from '@/lib/action-result';
import { aiErrorMessage, DEFAULT_INSTRUCTIONS_HASH, getAiContext } from '@/lib/ai';
import { getGitHubToken, getReadme, getRepoMeta } from '@/lib/github';
import { ingestRepo } from '@/lib/ingest';
import { GUIDE_PROMPT_VERSION, generateRepoGuide } from '@/lib/repo-guide';
import { getStackRepoIds } from '@/lib/repo-stats';
import { RepoUrlInput } from '@/lib/repo-url';
import { summarizePending } from '@/lib/summarize-batch';

/**
 * Builds the guide for a freshly added repo after the response, so the redirect is instant.
 * Release summaries are deliberately not started here: they are manual, because a backlog summarizing on its own left every release saying "Pending" with nothing visibly happening.
 */
function guideInBackground(repoId: number, label: string) {
  after(async () => {
    try {
      await buildRepoGuide(repoId);
    } catch (err) {
      console.error(`background guide failed for ${label}:`, err);
    }
  });
}

function revalidateRepoViews(owner?: string, name?: string) {
  revalidatePath('/');
  revalidatePath('/digest');
  revalidatePath('/repos');
  revalidatePath('/settings');
  if (owner && name) revalidatePath(`/repos/${owner}/${name}`);
}

/**
 * Adds the repo if it's new, watches it for the user, then pulls its releases.
 *
 * Always queued, not just for new releases: a repo can already be in the database with a backlog nobody has summarized yet.
 */
async function watchAndIngest(userId: string, owner: string, name: string): Promise<ActionResult> {
  await db.insert(repos).values({ owner, name }).onConflictDoNothing();
  const [repo] = await db
    .select()
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.name, name)));
  if (!repo) return { error: `Could not add ${owner}/${name}.` };

  await db.insert(stackRepos).values({ userId, repoId: repo.id }).onConflictDoNothing();

  try {
    await ingestRepo(repo);
  } catch (err) {
    console.error(`ingest failed for ${owner}/${name}:`, err);
    revalidateRepoViews(owner, name);
    return {
      error: `Watching ${owner}/${name}, but couldn't fetch releases (${errorMessage(err)}).`
    };
  }

  guideInBackground(repo.id, `${owner}/${name}`);

  revalidateRepoViews(owner, name);
  return { success: true };
}

export type AddRepoState = { error?: string; success?: boolean };

export async function addRepoByUrl(_prevState: AddRepoState, formData: FormData): Promise<AddRepoState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in to add repos.' };

  const parsed = RepoUrlInput.safeParse(formData.get('url'));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid repo URL' };
  }

  const { owner, name } = parsed.data;
  const result = await watchAndIngest(session.user.id, owner, name);
  if (result.error) return result;
  redirect(`/repos/${owner}/${name}`);
}

/**
 * One-click watch from the repo tables, where owner/name are already known.
 *
 * Land on the repo's own page, where the analysis is already running.
 */
export async function addToStack(owner: string, name: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in to add repos.' };

  const result = await watchAndIngest(session.user.id, owner, name);
  if (result.error) return result;
  redirect(`/repos/${owner}/${name}`);
}

export async function removeFromStack(repoId: number) {
  const session = await auth();
  if (!session?.user?.id) return;

  await db.delete(stackRepos).where(and(eq(stackRepos.userId, session.user.id), eq(stackRepos.repoId, repoId)));

  revalidateRepoViews();
}

/** Manual "check for new releases now" for a single repo. */
export async function refreshRepo(repoId: number): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in to refresh repos.' };

  const [repo] = await db.select().from(repos).where(eq(repos.id, repoId));
  if (!repo) return { error: 'Repo not found.' };

  try {
    const { fetched, inserted } = await ingestRepo(repo);

    revalidateRepoViews(repo.owner, repo.name);
    return {
      success: true,
      message: `${fetched} checked · ${inserted} new`
    };
  } catch (err) {
    console.error(`refresh failed for ${repo.owner}/${repo.name}:`, err);
    return { error: errorMessage(err) };
  }
}

/**
 * Generates (or refreshes) the "what is this / how do I use it" guide for a repo.
 *
 * The prompt asks for real repos, but a model cannot be held to that: it misremembers owners and names repos that were renamed or never existed.
 * Each one is checked against GitHub, which also returns the canonical name for a renamed repo.
 * Anything that does not resolve is dropped.
 */
export async function buildRepoGuide(repoId: number): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in to generate guides.' };

  const [repo] = await db.select().from(repos).where(eq(repos.id, repoId));
  if (!repo) return { error: 'Repo not found.' };

  const token = (await getGitHubToken(session.user.id)) ?? process.env.GITHUB_TOKEN;
  if (!token) return { error: 'No GitHub token available.' };

  const ai = await getAiContext(session.user.id, 'guide');

  try {
    const readme = await getReadme(repo.owner, repo.name, token);
    if (!readme) return { error: 'That repo has no README to explain.' };

    const readmeHash = createHash('sha256').update(readme).digest('hex');
    const [existing] = await db
      .select()
      .from(repoGuides)
      .where(and(eq(repoGuides.repoId, repoId), eq(repoGuides.instructionsHash, ai.instructionsHash)));

    if (existing?.readmeHash === readmeHash && existing.promptVersion === GUIDE_PROMPT_VERSION) {
      return { success: true, message: 'Guide is already up to date' };
    }

    const { output, usage, modelId } = await generateRepoGuide(
      {
        repo: `${repo.owner}/${repo.name}`,
        description: repo.description,
        readme
      },
      ai
    );
    console.log(`guide ${repo.owner}/${repo.name} - ${usage.totalTokens} tokens`);

    const checked = await Promise.all(
      output.alternatives.map(async (alt) => {
        const [owner, name] = alt.repo.split('/');
        if (!owner || !name) return null;
        const meta = await getRepoMeta(owner, name, token).catch(() => null);
        return meta ? { ...alt, repo: meta.full_name } : null;
      })
    );
    output.alternatives = checked.filter((alt) => alt !== null);

    await db
      .insert(repoGuides)
      .values({
        repoId,
        instructionsHash: ai.instructionsHash,
        readmeHash,
        model: modelId,
        promptVersion: GUIDE_PROMPT_VERSION,
        data: output
      })
      .onConflictDoUpdate({
        target: [repoGuides.repoId, repoGuides.instructionsHash],
        set: {
          readmeHash,
          model: modelId,
          promptVersion: GUIDE_PROMPT_VERSION,
          data: output,
          createdAt: new Date()
        }
      });

    revalidatePath(`/repos/${repo.owner}/${repo.name}`);
    return { success: true };
  } catch (err) {
    console.error(`guide failed for ${repo.owner}/${repo.name}:`, err);
    return { error: aiErrorMessage(err, ai.ownKey) };
  }
}

/**
 * Sync every repo in the caller's stack.
 * Failures are per-repo, never fatal.
 */
export async function syncStack(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in to sync.' };

  const mine = await db
    .select({ id: repos.id, owner: repos.owner, name: repos.name })
    .from(stackRepos)
    .innerJoin(repos, eq(repos.id, stackRepos.repoId))
    .where(eq(stackRepos.userId, session.user.id));

  let synced = 0;
  for (const repo of mine) {
    try {
      await ingestRepo(repo);
      synced += 1;
    } catch (err) {
      console.error(`sync failed for ${repo.owner}/${repo.name}:`, err);
    }
  }

  revalidateRepoViews();
  return { success: true, message: `${synced}/${mine.length} synced` };
}

/**
 * The model to summarize with: the user's own key and model, but the shared default prompt.
 * Every feed reads the default-hash summary, so a personalised one would be written and then never shown.
 */
async function summaryContext(userId: string) {
  const ai = await getAiContext(userId, 'summary');
  return { ...ai, instructions: null, instructionsHash: DEFAULT_INSTRUCTIONS_HASH };
}

/** How many releases one bulk click summarizes while the user waits. */
const BULK_LIMIT = 5;

/**
 * The bulk Summarize button: a few releases inline, then it says how many it did.
 * It used to hand the rest to `after()`, which is exactly the invisible background work that made "Pending" confusing.
 */
export async function summarizeStack(): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: 'Sign in to summarize.' };

  const repoIds = await getStackRepoIds(userId);
  if (repoIds.length === 0) return { error: 'Follow a repo first.' };

  const ai = await summaryContext(userId);
  const result = await summarizePending(ai, { repoIds, limit: BULK_LIMIT });
  if (result.pending === 0) return { success: true, message: 'Everything is summarized' };
  if (result.summarized === 0) return { error: aiErrorMessage(result.lastError, ai.ownKey) };

  revalidateRepoViews();
  const more = result.pending === BULK_LIMIT ? ' Press again for more.' : '';
  return { success: true, message: `Summarized ${result.summarized}.${more}` };
}

/** Summarizes one release, for the button on its row. Only releases from repos the user follows. */
export async function summarizeOneRelease(releaseId: number): Promise<ActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: 'Sign in to summarize.' };

  const [row] = await db
    .select({ repoId: releases.repoId })
    .from(releases)
    .innerJoin(stackRepos, and(eq(stackRepos.repoId, releases.repoId), eq(stackRepos.userId, userId)))
    .where(eq(releases.id, releaseId));
  if (!row) return { error: 'Follow this repo to summarize its releases.' };

  const ai = await summaryContext(userId);
  const result = await summarizePending(ai, { releaseId, limit: 1 });
  if (result.pending === 0) return { success: true, message: 'Already summarized' };
  if (result.summarized === 0) return { error: aiErrorMessage(result.lastError, ai.ownKey) };

  revalidateRepoViews();
  return { success: true, message: 'Summarized' };
}

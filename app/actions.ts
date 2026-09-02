"use server";

import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import {
  repoGuides,
  repos,
  stackRepos,
  userPreferences,
  users,
} from "@/db/schema";
import { getGitHubToken, getReadme } from "@/lib/github";
import { ingestRepo } from "@/lib/ingest";
import { GUIDE_PROMPT_VERSION, generateRepoGuide } from "@/lib/repo-guide";
import { RepoUrlInput } from "@/lib/repo-url";
import { MODEL } from "@/lib/summarize";
import { summarizePending } from "@/lib/summarize-batch";

export type ActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong";
}

/**
 * Summarizing is up to ten sequential LLM calls, which is far too slow to hold
 * a click open for. Ingest is what the user is waiting on; summaries land after
 * the response and show up on the next view. The queue is an anti-join, so a
 * run that gets cut short simply resumes where it left off.
 */
function summarizeInBackground(repoId: number, label: string) {
  after(async () => {
    try {
      await summarizePending({ repoId, limit: 10 });
    } catch (err) {
      console.error(`background summarize failed for ${label}:`, err);
    }
  });
}

function revalidateRepoViews(owner?: string, name?: string) {
  revalidatePath("/");
  revalidatePath("/digest");
  revalidatePath("/repos");
  revalidatePath("/settings");
  if (owner && name) revalidatePath(`/repos/${owner}/${name}`);
}

/** Adds the repo if it's new, watches it for the user, then pulls its releases. */
async function watchAndIngest(
  userId: string,
  owner: string,
  name: string,
): Promise<ActionResult> {
  await db.insert(repos).values({ owner, name }).onConflictDoNothing();
  const [repo] = await db
    .select()
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.name, name)));
  if (!repo) return { error: `Could not add ${owner}/${name}.` };

  await db
    .insert(stackRepos)
    .values({ userId, repoId: repo.id })
    .onConflictDoNothing();

  try {
    await ingestRepo(repo);
  } catch (err) {
    console.error(`ingest failed for ${owner}/${name}:`, err);
    revalidateRepoViews(owner, name);
    return {
      error: `Watching ${owner}/${name}, but couldn't fetch releases (${errorMessage(err)}).`,
    };
  }

  // Always queued, not just for new releases: a repo can already be in the
  // database with a backlog nobody has summarized yet.
  summarizeInBackground(repo.id, `${owner}/${name}`);

  revalidateRepoViews(owner, name);
  return { success: true };
}

export async function signInWithGitHub() {
  await signIn("github");
}

export async function signOutAction() {
  await signOut();
}

export type AddRepoState = { error?: string; success?: boolean };

export async function addRepoByUrl(
  _prevState: AddRepoState,
  formData: FormData,
): Promise<AddRepoState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to add repos." };

  const parsed = RepoUrlInput.safeParse(formData.get("url"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid repo URL" };
  }

  const { owner, name } = parsed.data;
  return watchAndIngest(session.user.id, owner, name);
}

/** One-click watch from the repo tables, where owner/name are already known. */
export async function addToStack(
  owner: string,
  name: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to watch repos." };

  return watchAndIngest(session.user.id, owner, name);
}

export async function removeFromStack(repoId: number) {
  const session = await auth();
  if (!session?.user?.id) return;

  await db
    .delete(stackRepos)
    .where(
      and(
        eq(stackRepos.userId, session.user.id),
        eq(stackRepos.repoId, repoId),
      ),
    );

  revalidateRepoViews();
}

/** Manual "check for new releases now" for a single repo. */
export async function refreshRepo(repoId: number): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to refresh repos." };

  const [repo] = await db.select().from(repos).where(eq(repos.id, repoId));
  if (!repo) return { error: "Repo not found." };

  try {
    const { fetched, inserted } = await ingestRepo(repo);
    summarizeInBackground(repoId, `${repo.owner}/${repo.name}`);

    revalidateRepoViews(repo.owner, repo.name);
    return {
      success: true,
      message: `${fetched} checked · ${inserted} new · summarizing…`,
    };
  } catch (err) {
    console.error(`refresh failed for ${repo.owner}/${repo.name}:`, err);
    return { error: errorMessage(err) };
  }
}

/** Generates (or refreshes) the "what is this / how do I use it" guide for a repo. */
export async function buildRepoGuide(repoId: number): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to generate guides." };

  const [repo] = await db.select().from(repos).where(eq(repos.id, repoId));
  if (!repo) return { error: "Repo not found." };

  const token =
    (await getGitHubToken(session.user.id)) ?? process.env.GITHUB_TOKEN;
  if (!token) return { error: "No GitHub token available." };

  try {
    const readme = await getReadme(repo.owner, repo.name, token);
    if (!readme) return { error: "That repo has no README to explain." };

    const readmeHash = createHash("sha256").update(readme).digest("hex");
    const [existing] = await db
      .select()
      .from(repoGuides)
      .where(eq(repoGuides.repoId, repoId));

    // Same README, same prompt - the stored guide still stands.
    if (
      existing?.readmeHash === readmeHash &&
      existing.promptVersion === GUIDE_PROMPT_VERSION
    ) {
      return { success: true, message: "Guide is already up to date" };
    }

    const { output, usage } = await generateRepoGuide({
      repo: `${repo.owner}/${repo.name}`,
      description: repo.description,
      readme,
    });
    console.log(
      `guide ${repo.owner}/${repo.name} - ${usage.totalTokens} tokens`,
    );

    await db
      .insert(repoGuides)
      .values({
        repoId,
        readmeHash,
        model: MODEL,
        promptVersion: GUIDE_PROMPT_VERSION,
        data: output,
      })
      .onConflictDoUpdate({
        target: repoGuides.repoId,
        set: {
          readmeHash,
          model: MODEL,
          promptVersion: GUIDE_PROMPT_VERSION,
          data: output,
          createdAt: new Date(),
        },
      });

    revalidatePath(`/repos/${repo.owner}/${repo.name}`);
    return { success: true };
  } catch (err) {
    console.error(`guide failed for ${repo.owner}/${repo.name}:`, err);
    return { error: errorMessage(err) };
  }
}

export type SaveInstructionsState = { error?: string; success?: boolean };

export async function saveAiInstructions(
  _prevState: SaveInstructionsState,
  formData: FormData,
): Promise<SaveInstructionsState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in required." };

  const instructions = String(formData.get("instructions") ?? "")
    .trim()
    .slice(0, 2000);

  await db
    .insert(userPreferences)
    .values({ userId: session.user.id, aiInstructions: instructions || null })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { aiInstructions: instructions || null, updatedAt: new Date() },
    });

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/digest");
  return { success: true };
}

/** Sync every repo in the caller's stack. Failures are per-repo, never fatal. */
export async function syncStack(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to sync." };

  const mine = await db
    .select({ id: repos.id, owner: repos.owner, name: repos.name })
    .from(stackRepos)
    .innerJoin(repos, eq(repos.id, stackRepos.repoId))
    .where(eq(stackRepos.userId, session.user.id));

  let synced = 0;
  for (const repo of mine) {
    try {
      await ingestRepo(repo);
      summarizeInBackground(repo.id, `${repo.owner}/${repo.name}`);
      synced += 1;
    } catch (err) {
      console.error(`sync failed for ${repo.owner}/${repo.name}:`, err);
    }
  }

  revalidateRepoViews();
  return { success: true, message: `${synced}/${mine.length} synced` };
}

/**
 * Deletes the Upstream account: user row, and by cascade the linked GitHub
 * account, stack and preferences. Repos, releases and summaries are shared
 * across users and deliberately survive.
 */
export async function deleteAccount(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in required." };

  await db.delete(users).where(eq(users.id, session.user.id));
  await signOut({ redirectTo: "/" });
  return { success: true };
}

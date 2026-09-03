'use server';

import { createHash } from 'node:crypto';
import { generateText } from 'ai';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { auth, signIn, signOut } from '@/auth';
import { db } from '@/db';
import { aiKeys, repoGuides, repos, stackRepos, userInstructions, userPreferences } from '@/db/schema';
import { aiErrorMessage, FEATURES, type Feature, getAiContext, modelFor } from '@/lib/ai';
import { findModel, PROVIDERS, type ProviderId } from '@/lib/ai-models';
import { encryptSecret } from '@/lib/crypto';
import { DigestDeliveryError, sendDigestToUser } from '@/lib/digest-email';
import {
  isDigestFrequency,
  isValidTimeZone,
  MAX_DAY_OF_MONTH,
  MAX_INTERVAL_DAYS,
  MIN_INTERVAL_DAYS
} from '@/lib/digest-schedule';
import { eraseAccount } from '@/lib/erase-account';
import { getGitHubToken, getReadme } from '@/lib/github';
import { ingestRepo } from '@/lib/ingest';
import { GUIDE_PROMPT_VERSION, generateRepoGuide } from '@/lib/repo-guide';
import { RepoUrlInput } from '@/lib/repo-url';
import { MODEL } from '@/lib/summarize';
import { summarizePending } from '@/lib/summarize-batch';

export type ActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong';
}

/**
 * Summarizing is up to ten sequential LLM calls, which is far too slow to hold
 * a click open for. Ingest is what the user is waiting on; summaries land after
 * the response and show up on the next view. The queue is an anti-join, so a
 * run that gets cut short simply resumes where it left off.
 */
function summarizeInBackground(userId: string, repoId: number, label: string) {
  after(async () => {
    try {
      const ai = await getAiContext(userId, 'summary');
      await summarizePending(ai, { repoId, limit: 10 });
    } catch (err) {
      console.error(`background summarize failed for ${label}:`, err);
    }
  });
}

/**
 * Everything a freshly added repo needs to be worth looking at: its release
 * summaries and its guide. Runs after the response so the redirect is instant,
 * and each piece is cached, so a repeat add costs nothing.
 */
function analyzeInBackground(userId: string, repoId: number, label: string) {
  after(async () => {
    try {
      const ai = await getAiContext(userId, 'summary');
      await summarizePending(ai, { repoId, limit: 10 });
    } catch (err) {
      console.error(`background summarize failed for ${label}:`, err);
    }

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

/** Adds the repo if it's new, watches it for the user, then pulls its releases. */
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

  // Always queued, not just for new releases: a repo can already be in the
  // database with a backlog nobody has summarized yet.
  analyzeInBackground(userId, repo.id, `${owner}/${name}`);

  revalidateRepoViews(owner, name);
  return { success: true };
}

export async function signInWithGitHub() {
  await signIn('github');
}

export async function signOutAction() {
  await signOut();
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

/** One-click watch from the repo tables, where owner/name are already known. */
export async function addToStack(owner: string, name: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in to add repos.' };

  const result = await watchAndIngest(session.user.id, owner, name);
  if (result.error) return result;
  // Land on the repo's own page, where the analysis is already running.
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
    summarizeInBackground(session.user.id, repoId, `${repo.owner}/${repo.name}`);

    revalidateRepoViews(repo.owner, repo.name);
    return {
      success: true,
      message: `${fetched} checked · ${inserted} new · summarizing…`
    };
  } catch (err) {
    console.error(`refresh failed for ${repo.owner}/${repo.name}:`, err);
    return { error: errorMessage(err) };
  }
}

/** Generates (or refreshes) the "what is this / how do I use it" guide for a repo. */
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

    // Same README, same prompt - the stored guide still stands.
    if (existing?.readmeHash === readmeHash && existing.promptVersion === GUIDE_PROMPT_VERSION) {
      return { success: true, message: 'Guide is already up to date' };
    }

    const { output, usage } = await generateRepoGuide(
      {
        repo: `${repo.owner}/${repo.name}`,
        description: repo.description,
        readme
      },
      ai
    );
    console.log(`guide ${repo.owner}/${repo.name} - ${usage.totalTokens} tokens`);

    await db
      .insert(repoGuides)
      .values({
        repoId,
        instructionsHash: ai.instructionsHash,
        readmeHash,
        model: MODEL,
        promptVersion: GUIDE_PROMPT_VERSION,
        data: output
      })
      .onConflictDoUpdate({
        target: [repoGuides.repoId, repoGuides.instructionsHash],
        set: {
          readmeHash,
          model: MODEL,
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

/** Sync every repo in the caller's stack. Failures are per-repo, never fatal. */
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
      summarizeInBackground(session.user.id, repo.id, `${repo.owner}/${repo.name}`);
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
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const report = await eraseAccount(session.user.id);
  console.log(`erased account ${session.user.id}:`, report);

  await signOut({ redirectTo: '/' });
  return { success: true };
}

export type KeyState = { error?: string; success?: boolean };

/** Saves a provider key after proving it can actually run the chosen model. */
export async function saveAiKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const provider = String(formData.get('provider') ?? '') as ProviderId;
  const modelId = String(formData.get('model') ?? '');
  const raw = String(formData.get('apiKey') ?? '').trim();

  if (!PROVIDERS.some((p) => p.id === provider)) {
    return { error: 'Unknown provider.' };
  }
  if (!raw) return { error: 'Paste a key.' };

  const model = findModel(modelId);
  if (!model || model.provider !== provider) {
    return { error: 'Pick a model for that provider.' };
  }

  try {
    await generateText({
      model: modelFor(provider, raw, modelId),
      prompt: 'OK'
    });
  } catch (err) {
    console.error(`key probe failed for ${provider}/${modelId}:`, err);
    return { error: aiErrorMessage(err, true) };
  }

  const hint = `…${raw.slice(-4)}`;
  await db
    .insert(aiKeys)
    .values({
      userId: session.user.id,
      provider,
      encryptedKey: encryptSecret(raw),
      hint
    })
    .onConflictDoUpdate({
      target: [aiKeys.userId, aiKeys.provider],
      set: { encryptedKey: encryptSecret(raw), hint }
    });

  await db
    .insert(userPreferences)
    .values({ userId: session.user.id, aiModel: modelId })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { aiModel: modelId, updatedAt: new Date() }
    });

  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { success: true };
}

export async function removeAiKey(provider: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  await db.delete(aiKeys).where(and(eq(aiKeys.userId, session.user.id), eq(aiKeys.provider, provider)));

  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { success: true };
}

/** Switches the active model. Rejects one the user has no key for. */
export async function selectAiModel(modelId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const model = findModel(modelId);
  if (!model) return { error: 'Unknown model.' };

  if (model.provider !== 'google') {
    const [key] = await db
      .select({ id: aiKeys.id })
      .from(aiKeys)
      .where(and(eq(aiKeys.userId, session.user.id), eq(aiKeys.provider, model.provider)));
    if (!key) {
      return { error: `Add a ${model.provider} key before selecting this.` };
    }
  }

  await db
    .insert(userPreferences)
    .values({ userId: session.user.id, aiModel: modelId })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { aiModel: modelId, updatedAt: new Date() }
    });

  revalidatePath('/', 'layout');
  return { success: true, message: model.label };
}

export type InstructionState = { error?: string; success?: boolean };

/** Per-feature instructions. Empty clears that feature's override. */
export async function saveInstruction(_prev: InstructionState, formData: FormData): Promise<InstructionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const feature = String(formData.get('feature') ?? '') as Feature;
  if (!FEATURES.some((f) => f.id === feature)) {
    return { error: 'Unknown feature.' };
  }

  const text = String(formData.get('text') ?? '')
    .trim()
    .slice(0, 2000);

  if (!text) {
    await db
      .delete(userInstructions)
      .where(and(eq(userInstructions.userId, session.user.id), eq(userInstructions.feature, feature)));
  } else {
    await db
      .insert(userInstructions)
      .values({ userId: session.user.id, feature, text })
      .onConflictDoUpdate({
        target: [userInstructions.userId, userInstructions.feature],
        set: { text, updatedAt: new Date() }
      });
  }

  revalidatePath('/settings');
  return { success: true };
}

export type EmailState = { error?: string; success?: boolean };

/** Where digests get sent. Blank resets to the GitHub account email. */
export async function saveDigestEmail(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const email = String(formData.get('email') ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "That doesn't look like an email address." };
  }

  await db
    .insert(userPreferences)
    .values({ userId: session.user.id, digestEmail: email || null })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { digestEmail: email || null, updatedAt: new Date() }
    });

  revalidatePath('/settings');
  return { success: true };
}

export type DigestState = { error?: string; success?: boolean };

/** Email address, opt-out and per-user schedule, saved together. */
export async function saveDigestSettings(_prev: DigestState, formData: FormData): Promise<DigestState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const email = String(formData.get('email') ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "That doesn't look like an email address." };
  }

  const rawFrequency = String(formData.get('frequency') ?? '');
  if (!isDigestFrequency(rawFrequency)) return { error: 'Pick a frequency.' };

  const hour = Number(formData.get('hour'));
  const weekday = Number(formData.get('weekday'));
  const dayOfMonth = Number(formData.get('dayOfMonth'));
  const intervalDays = Number(formData.get('intervalDays'));
  const timezone = String(formData.get('timezone') ?? 'UTC');

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { error: 'Pick an hour between 0 and 23.' };
  }
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { error: 'Pick a valid day.' };
  }
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > MAX_DAY_OF_MONTH) {
    return { error: `Pick a date between 1 and ${MAX_DAY_OF_MONTH}.` };
  }
  if (!Number.isInteger(intervalDays) || intervalDays < MIN_INTERVAL_DAYS || intervalDays > MAX_INTERVAL_DAYS) {
    return { error: `Pick a gap between ${MIN_INTERVAL_DAYS} and ${MAX_INTERVAL_DAYS} days.` };
  }
  // Zones come from the runtime's own ICU list, but the form is still a boundary.
  if (!isValidTimeZone(timezone)) {
    return { error: 'That is not a time zone Upstream recognises.' };
  }

  const values = {
    digestEmail: email || null,
    digestEnabled: formData.get('enabled') === 'on',
    digestFrequency: rawFrequency,
    digestHour: hour,
    digestWeekday: weekday,
    digestTimezone: timezone,
    digestDayOfMonth: dayOfMonth,
    digestIntervalDays: intervalDays
  };

  await db
    .insert(userPreferences)
    .values({ userId: session.user.id, ...values })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ...values, updatedAt: new Date() }
    });

  revalidatePath('/settings');
  return { success: true };
}

/**
 * Send the digest right now, on demand.
 *
 * Runs the same `sendDigestToUser` path the cron tick uses, so this doubles as
 * a rehearsal of the scheduled send rather than a parallel implementation that
 * can drift. Deliberately does NOT touch `lastDigestAt`: a test send should not
 * push the next scheduled one out by a cycle.
 */
export async function sendDigestNow(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  try {
    const result = await sendDigestToUser(session.user.id);

    if (!result.sent) {
      return { success: true, message: 'Nothing new to send - no summarized releases in the last 7 days.' };
    }

    const breaking = result.breaking > 0 ? `, ${result.breaking} breaking` : '';
    return { success: true, message: `Sent ${result.entries} releases${breaking} to ${result.to}.` };
  } catch (err) {
    if (err instanceof DigestDeliveryError) return { error: err.message };
    console.error('send digest now failed:', err);
    return { error: errorMessage(err) };
  }
}

'use server';

import { auth, signIn, signOut } from '@/auth';
import type { ActionResult } from '@/lib/action-result';
import { eraseAccount } from '@/lib/erase-account';

export async function signInWithGitHub() {
  await signIn('github');
}

export async function signOutAction() {
  await signOut();
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

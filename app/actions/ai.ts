'use server';

import { generateText } from 'ai';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/db';
import { aiKeys, userInstructions, userPreferences } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { aiErrorMessage, FEATURES, modelFor, serverProviders } from '@/lib/ai';
import { canRun, findModel, PROVIDERS, type ProviderId, providerOf } from '@/lib/ai-models';
import { encryptSecret } from '@/lib/crypto';

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

/**
 * Switches the active model.
 * Rejects one the user has no key for.
 */
export async function selectAiModel(modelId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const model = findModel(modelId);
  if (!model) return { error: 'Unknown model.' };

  const own = await db.select({ provider: aiKeys.provider }).from(aiKeys).where(eq(aiKeys.userId, session.user.id));
  if (!canRun(model, { own: own.map((k) => k.provider), server: serverProviders() })) {
    return { error: `Add a ${providerOf(model.provider)?.label ?? model.provider} key to use this model.` };
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

/**
 * Per-feature instructions.
 * Empty clears that feature's override.
 */
export async function saveInstruction(_prev: InstructionState, formData: FormData): Promise<InstructionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Sign in required.' };

  const userId = session.user.id;
  for (const { id: feature } of FEATURES) {
    const text = String(formData.get(feature) ?? '')
      .trim()
      .slice(0, 2000);

    if (!text) {
      await db
        .delete(userInstructions)
        .where(and(eq(userInstructions.userId, userId), eq(userInstructions.feature, feature)));
    } else {
      await db
        .insert(userInstructions)
        .values({ userId, feature, text })
        .onConflictDoUpdate({
          target: [userInstructions.userId, userInstructions.feature],
          set: { text, updatedAt: new Date() }
        });
    }
  }

  revalidatePath('/settings');
  return { success: true };
}

import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/db';
import { aiKeys, userPreferences } from '@/db/schema';
import { serverProviders } from '@/lib/ai';
import { DEFAULT_MODEL_ID } from '@/lib/ai-models';

/** What the header needs to render the model picker. */
export const getUserAiSummary = cache(async function getUserAiSummary(userId: string) {
  const [[prefs], keys] = await Promise.all([
    db.select({ aiModel: userPreferences.aiModel }).from(userPreferences).where(eq(userPreferences.userId, userId)),
    db.select({ provider: aiKeys.provider, hint: aiKeys.hint }).from(aiKeys).where(eq(aiKeys.userId, userId))
  ]);

  return {
    modelId: prefs?.aiModel ?? DEFAULT_MODEL_ID,
    /** Providers this user has stored their own key for. */
    keyedProviders: keys.map((key) => key.provider),
    /** Providers covered by a key in the server's env, free to everyone. */
    serverProviders: serverProviders(),
    keys
  };
});

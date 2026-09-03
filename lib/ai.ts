import { createHash } from 'node:crypto';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { aiKeys, userInstructions, userPreferences } from '@/db/schema';
import { DEFAULT_MODEL_ID, findModel, MODELS, PROVIDERS, type ProviderId } from '@/lib/ai-models';
import { decryptSecret } from '@/lib/crypto';

/** Keeps instruction-free output on the shared cache key. */
export const DEFAULT_INSTRUCTIONS_HASH = 'default';

/** Each AI surface gets its own instruction slot. */
export const FEATURES = [
  {
    id: 'global',
    label: 'All AI features',
    hint: 'Applied to everything unless a feature below overrides it.',
    placeholder: 'e.g. I work on a Next.js + Postgres app and care about upgrade risk.'
  },
  {
    id: 'summary',
    label: 'Release summaries',
    hint: 'Shapes how each release in the digest is written.',
    placeholder: 'e.g. Lead with anything that breaks a build. Ignore docs-only changes.'
  },
  {
    id: 'guide',
    label: 'Repo explanations',
    hint: 'Shapes the what-it-is, quick start, verdict and alternatives.',
    placeholder: 'e.g. Assume I know React. Compare against what I already use.'
  }
] as const;

export type Feature = (typeof FEATURES)[number]['id'];

export function instructionsHash(instructions: string | null) {
  const trimmed = instructions?.trim();
  if (!trimmed) return DEFAULT_INSTRUCTIONS_HASH;
  return createHash('sha256').update(trimmed).digest('hex').slice(0, 32);
}

export type AiContext = {
  model: LanguageModel;
  modelId: string;
  instructions: string | null;
  instructionsHash: string;
  /** True when the user supplied the key, so quota is on their account. */
  ownKey: boolean;
};

/**
 * Server-side keys, one per provider. Written out statically rather than looked
 * up from `PROVIDERS[].envVar`: bundlers inline `process.env.X` by literal name,
 * and a dynamic index quietly resolves to undefined in some builds.
 *
 * A provider with no key here is BYOK-only - it never appears in the picker
 * until the user adds their own key.
 */
export function serverKeyFor(provider: ProviderId): string | undefined {
  switch (provider) {
    case 'google':
      return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    case 'groq':
      return process.env.GROQ_API_KEY;
    case 'mistral':
      return process.env.MISTRAL_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY;
    case 'xai':
      return process.env.XAI_API_KEY;
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY;
    default:
      return undefined;
  }
}

/** Providers the server can cover for everyone, with no key from the user. */
export function serverProviders(): ProviderId[] {
  return PROVIDERS.map((provider) => provider.id).filter((id) => Boolean(serverKeyFor(id)));
}

function buildModel(provider: ProviderId, apiKey: string, modelId: string) {
  switch (provider) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case 'groq':
      return createGroq({ apiKey })(modelId);
    case 'mistral':
      return createMistral({ apiKey })(modelId);
    case 'openai':
      return createOpenAI({ apiKey })(modelId);
    case 'anthropic':
      return createAnthropic({ apiKey })(modelId);
    case 'deepseek':
      return createDeepSeek({ apiKey })(modelId);
    case 'xai':
      return createXai({ apiKey })(modelId);
    case 'openrouter':
      // OpenRouter speaks the OpenAI protocol.
      return createOpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1'
      })(modelId);
  }
}

/** Probe a key/model pair so a bad one fails on save, not on the next click. */
export function modelFor(provider: ProviderId, apiKey: string, modelId: string) {
  return buildModel(provider, apiKey, modelId);
}

/**
 * Resolves which model and instructions apply for one user and one feature.
 * A user's own key is preferred: it takes their work off the shared free-tier
 * quota, which is rate limited per project rather than unlimited.
 */
export async function getAiContext(userId: string, feature: Feature = 'global'): Promise<AiContext> {
  const [[prefs], keys, instructionRows] = await Promise.all([
    db.select({ aiModel: userPreferences.aiModel }).from(userPreferences).where(eq(userPreferences.userId, userId)),
    db
      .select({ provider: aiKeys.provider, encryptedKey: aiKeys.encryptedKey })
      .from(aiKeys)
      .where(eq(aiKeys.userId, userId)),
    db
      .select({
        feature: userInstructions.feature,
        text: userInstructions.text
      })
      .from(userInstructions)
      .where(eq(userInstructions.userId, userId))
  ]);

  // A feature's own instruction wins; otherwise the global one applies.
  const byFeature = new Map(instructionRows.map((row) => [row.feature, row.text]));
  const instructions = byFeature.get(feature)?.trim() || byFeature.get('global')?.trim() || null;

  const wanted = findModel(prefs?.aiModel) ?? findModel(DEFAULT_MODEL_ID);
  if (!wanted) throw new Error('No AI model configured.');

  const stored = keys.find((key) => key.provider === wanted.provider);
  const ownKey = stored ? decryptSecret(stored.encryptedKey) : null;

  // The user's own key wins; otherwise fall back to a server key if one is set
  // for that provider. Providers with neither are not offered in the picker.
  const apiKey = ownKey ?? serverKeyFor(wanted.provider);

  if (!apiKey) {
    throw new Error(`No API key for ${wanted.provider}. Add one from the model picker.`);
  }

  return {
    model: buildModel(wanted.provider, apiKey, wanted.id),
    modelId: wanted.id,
    instructions,
    instructionsHash: instructionsHash(instructions),
    ownKey: Boolean(ownKey)
  };
}

/** The server-key context used by the CLI batch scripts. */
export function serverAiContext(): AiContext {
  const preferred = findModel(DEFAULT_MODEL_ID);
  const fallback = MODELS.find((model) => model.tier === 'free' && serverKeyFor(model.provider));

  // The default model if its key is set, else any free model the server can run.
  const model = preferred && serverKeyFor(preferred.provider) ? preferred : fallback;
  const apiKey = model ? serverKeyFor(model.provider) : undefined;

  if (!model || !apiKey) {
    throw new Error('No server AI key is set. Add one of the provider keys from .env.example.');
  }

  return {
    model: buildModel(model.provider, apiKey, model.id),
    modelId: model.id,
    instructions: null,
    instructionsHash: DEFAULT_INSTRUCTIONS_HASH,
    ownKey: false
  };
}

/**
 * Free tiers are rate limited (requests per minute and per day), so a burst of
 * sequential calls trips them long before anything is "used up".
 */
export function aiErrorMessage(err: unknown, ownKey: boolean) {
  const status = (err as { statusCode?: number })?.statusCode;
  const message = err instanceof Error ? err.message : String(err);

  if (status === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
    return ownKey
      ? 'Your key hit its rate limit. Wait a minute, or pick a different model.'
      : 'The shared key hit its rate limit. Add your own key from the model picker.';
  }
  if (status === 401 || status === 403) {
    return ownKey ? 'Your key was rejected. Check it in Settings.' : "The server's AI key was rejected.";
  }
  if (status === 404) {
    return `Model not available on this account (${message.slice(0, 80)}).`;
  }
  return message;
}

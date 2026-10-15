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
import { canRun, DEFAULT_MODEL_ID, findModel, MODELS, PROVIDERS, type ProviderId } from '@/lib/ai-models';
import { decryptSecret } from '@/lib/crypto';

/** Keeps instruction-free output on the shared cache key. */
export const DEFAULT_INSTRUCTIONS_HASH = 'default';

/** Each AI surface gets its own instruction slot. */
export const FEATURES = [
  {
    id: 'global',
    label: 'All features',
    hint: 'Default for every feature.',
    placeholder: 'e.g. I work on a Next.js + Postgres app and care about upgrade risk.'
  },
  {
    id: 'summary',
    label: 'Release summaries',
    hint: 'Release summaries.',
    placeholder: 'e.g. Lead with anything that breaks a build. Ignore docs-only changes.'
  },
  {
    id: 'guide',
    label: 'Repo explanations',
    hint: 'Repo guides.',
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
  /** Free server-key models to try, in order, when `model` fails. */
  fallbacks: { id: string; model: LanguageModel }[];
};

/** Most attempts one call makes before giving up; each also retries once in the SDK. */
const MAX_FALLBACKS = 3;

/**
 * Free models the shared key can run, other providers first: quotas are per provider, so a different provider is the likeliest to have room.
 * Never a paid model, which would bill the host.
 */
function fallbackChain(skipId: string): AiContext['fallbacks'] {
  const free = MODELS.filter((m) => m.tier === 'free' && m.id !== skipId && serverKeyFor(m.provider));
  const skip = findModel(skipId)?.provider;
  const seen = new Set<string>();
  const firstPerProvider = free.filter((m) => m.provider !== skip && !seen.has(m.provider) && seen.add(m.provider));
  const ordered = [...firstPerProvider, ...free.filter((m) => !firstPerProvider.includes(m))];
  return ordered.slice(0, MAX_FALLBACKS).flatMap((m) => {
    const key = serverKeyFor(m.provider);
    return key ? [{ id: m.id, model: buildModel(m.provider, key, m.id) }] : [];
  });
}

/**
 * Runs one AI call on the chosen model, then on each fallback until one succeeds.
 * Any failure moves on - quota, "high demand", or output that did not fit the schema - because the next model may well manage.
 * Returns which model answered, so stored rows name the model that actually wrote them.
 */
export async function withFallback<T>(
  ai: AiContext,
  call: (model: LanguageModel) => Promise<T>
): Promise<{ result: T; modelId: string }> {
  const chain = [{ id: ai.modelId, model: ai.model }, ...ai.fallbacks];
  let lastError: unknown;
  for (const { id, model } of chain) {
    try {
      return { result: await call(model), modelId: id };
    } catch (err) {
      lastError = err;
      console.warn(`${id} failed, trying the next model:`, err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }
  throw lastError;
}

/**
 * Server-side keys, one per provider.
 * Written out statically rather than looked up from `PROVIDERS[].envVar`: bundlers inline `process.env.X` by literal name, and a dynamic index quietly resolves to undefined in some builds.
 *
 * A provider with no key here is BYOK-only - it never appears in the picker until the user adds their own key.
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
 * A user's own key is preferred: it takes their work off the shared free-tier quota, which is rate limited per project rather than unlimited.
 *
 * A saved choice can stop being runnable (key removed, paid model on the shared key); fall back to the default rather than fail every summary.
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

  const byFeature = new Map(instructionRows.map((row) => [row.feature, row.text]));
  const instructions = byFeature.get(feature)?.trim() || byFeature.get('global')?.trim() || null;

  const own = keys.map((key) => key.provider);
  const chosen = findModel(prefs?.aiModel);
  const wanted = chosen && canRun(chosen, { own, server: serverProviders() }) ? chosen : findModel(DEFAULT_MODEL_ID);
  if (!wanted) throw new Error('No AI model configured.');

  const stored = keys.find((key) => key.provider === wanted.provider);
  const ownKey = stored ? decryptSecret(stored.encryptedKey) : null;

  const apiKey = ownKey ?? serverKeyFor(wanted.provider);

  if (!apiKey) {
    throw new Error(`No API key for ${wanted.provider}. Add one from the model picker.`);
  }

  return {
    model: buildModel(wanted.provider, apiKey, wanted.id),
    modelId: wanted.id,
    instructions,
    instructionsHash: instructionsHash(instructions),
    ownKey: Boolean(ownKey),
    fallbacks: fallbackChain(wanted.id)
  };
}

/** The server-key context used by the CLI batch scripts. */
export function serverAiContext(): AiContext {
  const preferred = findModel(DEFAULT_MODEL_ID);
  const fallback = MODELS.find((model) => model.tier === 'free' && serverKeyFor(model.provider));

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
    ownKey: false,
    fallbacks: fallbackChain(model.id)
  };
}

/**
 * Free tiers are rate limited (requests per minute and per day), so a burst of sequential calls trips them long before anything is "used up".
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

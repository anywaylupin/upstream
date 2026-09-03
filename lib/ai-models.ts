/**
 * The model catalogue.
 *
 * Pure and client-safe - no `db`, no `process.env`. Which providers are
 * actually usable depends on server env keys and the user's own stored keys,
 * and that is resolved server-side in `lib/ai-settings.ts` then passed down.
 */

export const PROVIDERS = [
  {
    id: 'google',
    label: 'Google AI Studio',
    /** The server-side key that makes this provider available to everyone. */
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    keysUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza...',
    /** Whether the provider gives a recurring free allowance. */
    freeTier: 'Free tier that resets per minute and per day.'
  },
  {
    id: 'groq',
    label: 'Groq',
    envVar: 'GROQ_API_KEY',
    keysUrl: 'https://console.groq.com/keys',
    keyPrefix: 'gsk_...',
    freeTier: 'Free tier that resets per minute and per day.'
  },
  {
    id: 'mistral',
    label: 'Mistral',
    envVar: 'MISTRAL_API_KEY',
    keysUrl: 'https://console.mistral.ai/api-keys',
    keyPrefix: '...',
    freeTier: 'Free "Experiment" tier, rate limited.'
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-...',
    freeTier: 'No free tier. Pay per token.'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    envVar: 'DEEPSEEK_API_KEY',
    keysUrl: 'https://platform.deepseek.com/api_keys',
    keyPrefix: 'sk-...',
    freeTier: 'No free tier, but among the cheapest per token.'
  },
  {
    id: 'xai',
    label: 'xAI',
    envVar: 'XAI_API_KEY',
    keysUrl: 'https://console.x.ai',
    keyPrefix: 'xai-...',
    freeTier: 'No free tier. Pay per token.'
  },
  {
    id: 'openai',
    label: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    keysUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-...',
    freeTier: 'No free tier. Pay per token.'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    envVar: 'OPENROUTER_API_KEY',
    keysUrl: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-...',
    freeTier: 'Models tagged :free reset daily. Everything else is pay per token.'
  }
] as const;

export type ProviderId = (typeof PROVIDERS)[number]['id'];

/** `free` means a recurring allowance that refills on its own, not a trial. */
export type ModelTier = 'free' | 'paid';

export type ModelOption = {
  id: string;
  provider: ProviderId;
  label: string;
  tier: ModelTier;
  /** A few words on limits or what the model is for. */
  note: string;
};

/**
 * Model ids go stale - `gemini-2.5-flash` was retired mid-project and broke
 * every summary silently. Nothing here is trusted: a model is probed with a
 * live call before it is saved, so a dead id fails at the picker rather than
 * halfway through a run.
 *
 * OpenRouter alone proxies hundreds of models, so this is a curated catalogue
 * rather than a literal mirror of every provider's list.
 */
export const MODELS: ModelOption[] = [
  // --- Google -------------------------------------------------------------
  {
    id: 'gemini-3.6-flash',
    provider: 'google',
    label: 'Gemini 3.6 Flash',
    tier: 'free',
    note: 'Balanced. The default.'
  },
  {
    id: 'gemini-3.6-flash-lite',
    provider: 'google',
    label: 'Gemini 3.6 Flash Lite',
    tier: 'free',
    note: 'Cheapest, highest free limits.'
  },
  {
    id: 'gemini-3.6-pro',
    provider: 'google',
    label: 'Gemini 3.6 Pro',
    tier: 'paid',
    note: 'Strongest reasoning.'
  },

  // --- Groq ---------------------------------------------------------------
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    label: 'Llama 3.3 70B',
    tier: 'free',
    note: 'Fast and capable.'
  },
  {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    label: 'Llama 3.1 8B Instant',
    tier: 'free',
    note: 'Highest limits, weakest output.'
  },
  {
    id: 'openai/gpt-oss-120b',
    provider: 'groq',
    label: 'GPT-OSS 120B',
    tier: 'free',
    note: 'Open-weight, strong at structure.'
  },
  {
    id: 'openai/gpt-oss-20b',
    provider: 'groq',
    label: 'GPT-OSS 20B',
    tier: 'free',
    note: 'Smaller, quicker.'
  },
  {
    id: 'moonshotai/kimi-k2-instruct',
    provider: 'groq',
    label: 'Kimi K2',
    tier: 'free',
    note: 'Long context.'
  },
  {
    id: 'qwen/qwen3-32b',
    provider: 'groq',
    label: 'Qwen3 32B',
    tier: 'free',
    note: 'Good at code changelogs.'
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    provider: 'groq',
    label: 'DeepSeek R1 Distill 70B',
    tier: 'free',
    note: 'Reasoning distill.'
  },

  // --- Mistral ------------------------------------------------------------
  {
    id: 'mistral-small-latest',
    provider: 'mistral',
    label: 'Mistral Small',
    tier: 'free',
    note: 'Free tier, solid default.'
  },
  {
    id: 'open-mistral-nemo',
    provider: 'mistral',
    label: 'Mistral Nemo',
    tier: 'free',
    note: 'Free tier, lightweight.'
  },
  {
    id: 'ministral-8b-latest',
    provider: 'mistral',
    label: 'Ministral 8B',
    tier: 'paid',
    note: 'Cheap edge model.'
  },
  {
    id: 'mistral-medium-latest',
    provider: 'mistral',
    label: 'Mistral Medium',
    tier: 'paid',
    note: 'Mid-range.'
  },
  {
    id: 'mistral-large-latest',
    provider: 'mistral',
    label: 'Mistral Large',
    tier: 'paid',
    note: 'Flagship.'
  },
  {
    id: 'magistral-medium-latest',
    provider: 'mistral',
    label: 'Magistral Medium',
    tier: 'paid',
    note: 'Reasoning.'
  },
  {
    id: 'codestral-latest',
    provider: 'mistral',
    label: 'Codestral',
    tier: 'paid',
    note: 'Code-focused.'
  },

  // --- OpenAI -------------------------------------------------------------
  {
    id: 'gpt-5',
    provider: 'openai',
    label: 'GPT-5',
    tier: 'paid',
    note: 'Flagship.'
  },
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    label: 'GPT-5 mini',
    tier: 'paid',
    note: 'Cheaper, still strong.'
  },
  {
    id: 'gpt-5-nano',
    provider: 'openai',
    label: 'GPT-5 nano',
    tier: 'paid',
    note: 'Cheapest, high volume.'
  },
  {
    id: 'gpt-4.1',
    provider: 'openai',
    label: 'GPT-4.1',
    tier: 'paid',
    note: 'Previous flagship.'
  },
  {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    label: 'GPT-4.1 mini',
    tier: 'paid',
    note: 'Cheap and quick.'
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o mini',
    tier: 'paid',
    note: 'Older, very cheap.'
  },
  {
    id: 'o4-mini',
    provider: 'openai',
    label: 'o4-mini',
    tier: 'paid',
    note: 'Reasoning, cheap.'
  },

  // --- Anthropic ----------------------------------------------------------
  {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    label: 'Claude Sonnet 5',
    tier: 'paid',
    note: 'Best balance for changelog prose.'
  },
  {
    id: 'claude-opus-5',
    provider: 'anthropic',
    label: 'Claude Opus 5',
    tier: 'paid',
    note: 'Most capable, most expensive.'
  },
  {
    id: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    label: 'Claude Haiku 4.5',
    tier: 'paid',
    note: 'Fast and cheap.'
  },

  // --- DeepSeek -----------------------------------------------------------
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    label: 'DeepSeek Chat',
    tier: 'paid',
    note: 'Very cheap per token.'
  },
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    label: 'DeepSeek Reasoner',
    tier: 'paid',
    note: 'Reasoning, still cheap.'
  },

  // --- xAI ----------------------------------------------------------------
  {
    id: 'grok-4',
    provider: 'xai',
    label: 'Grok 4',
    tier: 'paid',
    note: 'Flagship.'
  },
  {
    id: 'grok-3-mini',
    provider: 'xai',
    label: 'Grok 3 mini',
    tier: 'paid',
    note: 'Cheaper, quick.'
  },

  // --- OpenRouter ---------------------------------------------------------
  {
    id: 'deepseek/deepseek-chat-v3.1:free',
    provider: 'openrouter',
    label: 'DeepSeek V3.1',
    tier: 'free',
    note: 'Free daily allowance.'
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    provider: 'openrouter',
    label: 'Llama 3.3 70B',
    tier: 'free',
    note: 'Free daily allowance.'
  },
  {
    id: 'qwen/qwen3-coder:free',
    provider: 'openrouter',
    label: 'Qwen3 Coder',
    tier: 'free',
    note: 'Free, tuned for code.'
  },
  {
    id: 'mistralai/mistral-small-3.2-24b-instruct:free',
    provider: 'openrouter',
    label: 'Mistral Small 3.2',
    tier: 'free',
    note: 'Free daily allowance.'
  },
  {
    id: 'google/gemma-3-27b-it:free',
    provider: 'openrouter',
    label: 'Gemma 3 27B',
    tier: 'free',
    note: 'Free daily allowance.'
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    provider: 'openrouter',
    label: 'Claude Sonnet 4.5',
    tier: 'paid',
    note: 'Strong at prose summaries.'
  },
  {
    id: 'openai/gpt-5',
    provider: 'openrouter',
    label: 'GPT-5',
    tier: 'paid',
    note: 'Via OpenRouter billing.'
  },
  {
    id: 'google/gemini-2.5-pro',
    provider: 'openrouter',
    label: 'Gemini 2.5 Pro',
    tier: 'paid',
    note: 'Via OpenRouter billing.'
  },
  {
    id: 'x-ai/grok-4',
    provider: 'openrouter',
    label: 'Grok 4',
    tier: 'paid',
    note: 'Via OpenRouter billing.'
  },
  {
    id: 'deepseek/deepseek-chat-v3.1',
    provider: 'openrouter',
    label: 'DeepSeek V3.1 (paid)',
    tier: 'paid',
    note: 'No daily cap.'
  }
];

/** The model used when a user has picked nothing - runs on the server key. */
export const DEFAULT_MODEL_ID = 'gemini-3.6-flash';

export function findModel(id: string | null | undefined) {
  return MODELS.find((model) => model.id === id) ?? null;
}

export function providerOf(id: string) {
  return PROVIDERS.find((provider) => provider.id === id) ?? null;
}

export function modelsByProvider(provider: ProviderId) {
  return MODELS.filter((model) => model.provider === provider);
}

/** Free first, so the zero-cost options are the ones you see without scrolling. */
export function sortedModelsByProvider(provider: ProviderId) {
  return modelsByProvider(provider).sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'free' ? -1 : 1;
    return 0;
  });
}

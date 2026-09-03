export const PROVIDERS = [
  {
    id: 'google',
    label: 'Google AI Studio',
    keysUrl: 'https://aistudio.google.com/apikey',
    keyPrefix: 'AIza…'
  },
  {
    id: 'groq',
    label: 'Groq',
    keysUrl: 'https://console.groq.com/keys',
    keyPrefix: 'gsk_…'
  },
  {
    id: 'mistral',
    label: 'Mistral',
    keysUrl: 'https://console.mistral.ai/api-keys',
    keyPrefix: '…'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keysUrl: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-…'
  }
] as const;

export type ProviderId = (typeof PROVIDERS)[number]['id'];

export type ModelOption = {
  id: string;
  provider: ProviderId;
  label: string;
  /** What the provider's free tier gives you, in a few words. */
  free: string;
};

/**
 * Popular models with a usable free tier. Model ids go stale (gemini-2.5-flash
 * was retired mid-project), so every selection is probed against the provider
 * before it is saved rather than trusted from this list.
 */
export const MODELS: ModelOption[] = [
  {
    id: 'gemini-3.6-flash',
    provider: 'google',
    label: 'Gemini 3.6 Flash',
    free: 'free tier, rate limited per minute'
  },
  {
    id: 'gemini-3.6-flash-lite',
    provider: 'google',
    label: 'Gemini 3.6 Flash Lite',
    free: 'free tier, higher limits'
  },
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    label: 'Llama 3.3 70B',
    free: 'free tier, very fast'
  },
  {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    label: 'Llama 3.1 8B Instant',
    free: 'free tier, highest limits'
  },
  {
    id: 'openai/gpt-oss-20b',
    provider: 'groq',
    label: 'GPT-OSS 20B',
    free: 'free tier on Groq'
  },
  {
    id: 'mistral-small-latest',
    provider: 'mistral',
    label: 'Mistral Small',
    free: 'free tier'
  },
  {
    id: 'open-mistral-nemo',
    provider: 'mistral',
    label: 'Mistral Nemo',
    free: 'free tier'
  },
  {
    id: 'deepseek/deepseek-chat-v3.1:free',
    provider: 'openrouter',
    label: 'DeepSeek V3.1 (free)',
    free: 'free via OpenRouter'
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    provider: 'openrouter',
    label: 'Llama 3.3 70B (free)',
    free: 'free via OpenRouter'
  },
  {
    id: 'qwen/qwen3-coder:free',
    provider: 'openrouter',
    label: 'Qwen3 Coder (free)',
    free: 'free via OpenRouter'
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

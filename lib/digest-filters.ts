import type { ReleaseSummary } from '@/lib/summarize';

/**
 * Shared by the server page and the client filter bar. These must live outside
 * the "use client" module: a server component importing a value from one gets a
 * client-reference proxy, not the array.
 */
export const CHANGE_TYPES = [
  'breaking',
  'feature',
  'fix',
  'perf',
  'deprecation'
] as const satisfies readonly ReleaseSummary['changes'][number]['type'][];

export const EFFORTS = ['none', 'low', 'medium', 'high'] as const satisfies readonly ReleaseSummary['upgradeEffort'][];

export const WINDOWS = [7, 30, 90] as const;

export type DigestFilterState = {
  types: string[];
  effort: string[];
  repos: string[];
  days: number;
  q: string;
};

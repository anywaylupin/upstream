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

/**
 * Colours for the filter options, as literal class strings so Tailwind can see
 * them. Shared with the server page for the same reason the arrays above are:
 * a "use client" module cannot export a value into a server component.
 *
 * Breaking and high effort deliberately borrow the destructive hue - they are
 * the two things the digest exists to warn you about.
 */
export const CHANGE_TYPE_DOT: Record<string, string> = {
  breaking: 'bg-red-500',
  deprecation: 'bg-amber-500',
  feature: 'bg-emerald-500',
  fix: 'bg-sky-500',
  perf: 'bg-violet-500'
};

export const EFFORT_DOT: Record<string, string> = {
  none: 'bg-slate-400',
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500'
};

export const WINDOW_DOT = 'bg-muted-foreground';

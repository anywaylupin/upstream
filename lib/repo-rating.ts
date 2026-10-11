import { z } from 'zod';
import type { RepoGuide } from '@/lib/repo-guide';

/** Days of release history the activity and stability scores look at. */
export const RATING_WINDOW_DAYS = 90;

export type RatingInput = {
  stars: number | null;
  forks: number | null;
  watchers: number | null;
  openIssues: number | null;
  pushedAt: Date | null;
  archived: boolean | null;
  license: string | null;
  releases90d: number;
  /** Releases in the window that have a summary - the only ones that can show a break. */
  summarized90d: number;
  breaking90d: number;
  totalReleases: number;
  lastRelease: Date | null;
  guide: RepoGuide | null;
};

export const CRITERIA = [
  { id: 'activity', label: 'Activity', hint: 'How often it ships' },
  { id: 'stability', label: 'Stability', hint: 'How rarely releases break' },
  { id: 'reach', label: 'Popularity', hint: 'Stars' },
  { id: 'community', label: 'Adoption', hint: 'Forks and watchers' },
  { id: 'upkeep', label: 'Maintained', hint: 'Recent pushes, issue load' },
  { id: 'docs', label: 'Docs', hint: 'README quality, AI judged' },
  { id: 'ease', label: 'Ease', hint: 'How quick to pick up, AI judged' }
] as const;

export type CriterionId = (typeof CRITERIA)[number]['id'];

export const MAX_WEIGHT = 5;

/** 0 drops a criterion from the score entirely. */
export const Weights = z.object(
  Object.fromEntries(CRITERIA.map((c) => [c.id, z.number().int().min(0).max(MAX_WEIGHT)])) as Record<
    CriterionId,
    z.ZodNumber
  >
);

export type Weights = Record<CriterionId, number>;

export const PRESETS = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'An even read of health and popularity.',
    weights: { activity: 3, stability: 3, reach: 2, community: 2, upkeep: 2, docs: 1, ease: 1 }
  },
  {
    id: 'production',
    label: 'Production-safe',
    description: 'Favours stable, well-maintained projects.',
    weights: { activity: 1, stability: 5, reach: 1, community: 1, upkeep: 4, docs: 2, ease: 1 }
  },
  {
    id: 'bleeding',
    label: 'Bleeding edge',
    description: 'Favours projects that ship often.',
    weights: { activity: 5, stability: 1, reach: 1, community: 1, upkeep: 3, docs: 1, ease: 1 }
  },
  {
    id: 'popular',
    label: 'Popular',
    description: 'Favours what most people already use.',
    weights: { activity: 1, stability: 1, reach: 5, community: 4, upkeep: 1, docs: 1, ease: 1 }
  }
] as const satisfies readonly { id: string; label: string; description: string; weights: Weights }[];

export const DEFAULT_WEIGHTS: Weights = PRESETS[0].weights;

/** Stored jsonb is untrusted: anything malformed falls back to the default. */
export function parseWeights(value: unknown): Weights {
  const parsed = Weights.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_WEIGHTS;
}

export function presetFor(weights: Weights) {
  return PRESETS.find((preset) => CRITERIA.every((c) => preset.weights[c.id] === weights[c.id])) ?? null;
}

export type RepoRating = {
  overall: number;
  parts: { label: string; score: number; hint: string; weight: number }[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(10, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function daysSince(date: Date | null) {
  if (!date) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / 86_400_000;
}

/**
 * Measured where possible, judged only where it has to be. Everything except
 * Docs and Ease comes from GitHub numbers and this app's own release history.
 *
 * Note: GitHub's "used by" (dependents) count is not in the REST API - it only
 * exists on the dependency-graph HTML page - so it is deliberately absent.
 */
export function rateRepo(input: RatingInput, weights: Weights = DEFAULT_WEIGHTS): RepoRating {
  const sinceRelease = daysSince(input.lastRelease);
  const sincePush = daysSince(input.pushedAt);

  // Shipping cadence, with a hard cut for projects that stopped shipping.
  const activity = sinceRelease > 180 ? clamp(3 - sinceRelease / 365) : clamp(Math.log2(input.releases90d + 1) * 2.6);

  const stability =
    input.summarized90d > 0
      ? clamp(10 - (input.breaking90d / input.summarized90d) * 10)
      : (input.guide?.scores.apiStability ?? 5);

  const reach = clamp(Math.log10((input.stars ?? 0) + 1) * 2);

  // Forks and watchers say more about real use than stars alone.
  const community = clamp(Math.log10((input.forks ?? 0) + (input.watchers ?? 0) + 1) * 2.4);

  // An archived repo is unmaintained by definition; otherwise recency of any
  // push, nudged down when the issue tracker is very large relative to stars.
  const issueDrag =
    input.openIssues && input.stars ? Math.min(2, (input.openIssues / Math.max(input.stars, 1)) * 20) : 0;
  const upkeep = input.archived ? 0 : clamp(10 - sincePush / 30 - issueDrag);

  const parts: {
    id: CriterionId;
    label: string;
    score: number;
    hint: string;
  }[] = [
    {
      id: 'activity',
      label: 'Activity',
      score: activity,
      hint: `${input.releases90d} releases in ${RATING_WINDOW_DAYS}d`
    },
    {
      id: 'stability',
      label: 'Stability',
      score: stability,
      hint: `${input.breaking90d} breaking in ${RATING_WINDOW_DAYS}d`
    },
    {
      id: 'reach',
      label: 'Popularity',
      score: reach,
      hint: `${(input.stars ?? 0).toLocaleString()} stars`
    },
    {
      id: 'community',
      label: 'Adoption',
      score: community,
      hint: `${(input.forks ?? 0).toLocaleString()} forks · ${(input.watchers ?? 0).toLocaleString()} watchers`
    },
    {
      id: 'upkeep',
      label: 'Maintained',
      score: upkeep,
      hint: input.archived
        ? 'archived'
        : Number.isFinite(sincePush)
          ? `pushed ${Math.round(sincePush)}d ago`
          : 'no push data'
    }
  ];

  if (input.guide) {
    parts.push(
      {
        id: 'docs',
        label: 'Docs',
        score: clamp(input.guide.scores.docs),
        hint: 'from the README'
      },
      {
        id: 'ease',
        label: 'Ease',
        score: clamp(input.guide.scores.ease),
        hint: 'from the README'
      }
    );
  }

  // Every weight at zero would divide by zero; read that as "no preference".
  const active = parts.some((part) => weights[part.id] > 0) ? weights : DEFAULT_WEIGHTS;
  const totalWeight = parts.reduce((sum, part) => sum + active[part.id], 0);
  const overall = round(parts.reduce((sum, part) => sum + part.score * active[part.id], 0) / totalWeight);

  return {
    overall,
    parts: parts
      .filter((part) => active[part.id] > 0)
      .map((part) => ({
        label: part.label,
        score: round(part.score),
        hint: part.hint,
        weight: active[part.id]
      }))
  };
}

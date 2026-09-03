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
  breaking90d: number;
  totalReleases: number;
  lastRelease: Date | null;
  guide: RepoGuide | null;
};

export type RepoRating = {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D';
  parts: { label: string; score: number; hint: string }[];
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
export function rateRepo(input: RatingInput): RepoRating {
  const sinceRelease = daysSince(input.lastRelease);
  const sincePush = daysSince(input.pushedAt);

  // Shipping cadence, with a hard cut for projects that stopped shipping.
  const activity = sinceRelease > 180 ? clamp(3 - sinceRelease / 365) : clamp(Math.log2(input.releases90d + 1) * 2.6);

  const stability =
    input.releases90d > 0
      ? clamp(10 - (input.breaking90d / input.releases90d) * 10)
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
    label: string;
    score: number;
    hint: string;
    weight: number;
  }[] = [
    {
      label: 'Activity',
      score: activity,
      hint: `${input.releases90d} releases in ${RATING_WINDOW_DAYS}d`,
      weight: 0.22
    },
    {
      label: 'Stability',
      score: stability,
      hint: `${input.breaking90d} breaking in ${RATING_WINDOW_DAYS}d`,
      weight: 0.22
    },
    {
      label: 'Reach',
      score: reach,
      hint: `${(input.stars ?? 0).toLocaleString()} stars`,
      weight: 0.14
    },
    {
      label: 'Community',
      score: community,
      hint: `${(input.forks ?? 0).toLocaleString()} forks · ${(input.watchers ?? 0).toLocaleString()} watchers`,
      weight: 0.14
    },
    {
      label: 'Upkeep',
      score: upkeep,
      hint: input.archived
        ? 'archived'
        : Number.isFinite(sincePush)
          ? `pushed ${Math.round(sincePush)}d ago`
          : 'no push data',
      weight: 0.14
    }
  ];

  if (input.guide) {
    parts.push(
      {
        label: 'Docs',
        score: clamp(input.guide.scores.docs),
        hint: 'from the README',
        weight: 0.07
      },
      {
        label: 'Ease',
        score: clamp(input.guide.scores.ease),
        hint: 'from the README',
        weight: 0.07
      }
    );
  }

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const overall = round(parts.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight);

  return {
    overall,
    grade: overall >= 8 ? 'A' : overall >= 6.5 ? 'B' : overall >= 5 ? 'C' : 'D',
    parts: parts.map((part) => ({
      label: part.label,
      score: round(part.score),
      hint: part.hint
    }))
  };
}

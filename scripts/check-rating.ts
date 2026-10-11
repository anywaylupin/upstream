/** Asserts the rating weights maths. Run with `pnpm check:rating`; needs no env. */
import assert from 'node:assert/strict';
import { canRun, findModel } from '@/lib/ai-models';
import { upgradeVerdict } from '@/lib/digest-filters';
import { DEFAULT_WEIGHTS, PRESETS, parseWeights, presetFor, rateRepo } from '@/lib/repo-rating';

const input = {
  stars: 50_000,
  forks: 5_000,
  watchers: 800,
  openIssues: 200,
  pushedAt: new Date(),
  archived: false,
  license: 'MIT',
  releases90d: 12,
  summarized90d: 12,
  breaking90d: 0,
  totalReleases: 100,
  lastRelease: new Date(),
  guide: null
};

const zero = { activity: 0, stability: 0, reach: 0, community: 0, upkeep: 0, docs: 0, ease: 0 };

// A single weighted criterion makes the overall equal to that criterion.
const onlyStability = rateRepo(input, { ...zero, stability: 5 });
assert.deepEqual(
  onlyStability.parts.map((p) => p.label),
  ['Stability']
);
assert.equal(onlyStability.overall, onlyStability.parts[0]?.score);

// Scaling every weight by the same factor changes nothing.
const half = { activity: 2, stability: 2, reach: 1, community: 1, upkeep: 1, docs: 1, ease: 1 };
const full = { activity: 4, stability: 4, reach: 2, community: 2, upkeep: 2, docs: 2, ease: 2 };
assert.equal(rateRepo(input, half).overall, rateRepo(input, full).overall);

// All zeros would divide by zero; it falls back to the default.
assert.equal(rateRepo(input, zero).overall, rateRepo(input).overall);

// Docs and Ease need a guide; weighting them without one must not count them.
assert.ok(!rateRepo(input, { ...zero, docs: 5, activity: 1 }).parts.some((p) => p.label === 'Docs'));

// Untrusted stored jsonb.
assert.deepEqual(parseWeights(null), DEFAULT_WEIGHTS);
assert.deepEqual(parseWeights({ activity: 99 }), DEFAULT_WEIGHTS);
assert.deepEqual(parseWeights({ ...DEFAULT_WEIGHTS, reach: 1.5 }), DEFAULT_WEIGHTS);
assert.equal(presetFor(PRESETS[2].weights)?.id, 'bleeding');
assert.equal(presetFor({ ...DEFAULT_WEIGHTS, ease: 0 }), null);

// Presets actually reorder: a quiet, very stable repo beats a busy, breaking one on Production-safe.
const steady = { ...input, releases90d: 2, summarized90d: 2, breaking90d: 0, stars: 2_000 };
const churny = { ...input, releases90d: 30, summarized90d: 30, breaking90d: 12, stars: 90_000 };
const production = PRESETS[1].weights;
assert.ok(rateRepo(steady, production).overall > rateRepo(churny, production).overall);
assert.ok(rateRepo(churny, PRESETS[3].weights).overall > rateRepo(steady, PRESETS[3].weights).overall);

// Unsummarized releases count as activity but not as evidence of stability.
const unsummarized = { ...input, releases90d: 5, summarized90d: 0, breaking90d: 0 };
const activityOf = (r: typeof input) => rateRepo(r, { ...zero, activity: 1 }).overall;
assert.ok(activityOf(unsummarized) > 0);
assert.equal(rateRepo(unsummarized, { ...zero, stability: 1 }).overall, 5); // no guide, no evidence: neutral

// The upgrade verdict: breaking wins, then effort or a deprecation, else safe.
const release = (type: 'feature' | 'breaking' | 'deprecation', upgradeEffort: 'none' | 'low' | 'medium' | 'high') => ({
  headline: 'x',
  upgradeEffort,
  changes: [{ type, description: 'x' }]
});
assert.equal(upgradeVerdict(release('breaking', 'none')), 'breaking');
assert.equal(upgradeVerdict(release('feature', 'high')), 'review');
assert.equal(upgradeVerdict(release('deprecation', 'low')), 'review');
assert.equal(upgradeVerdict(release('feature', 'low')), 'safe');

// Model availability: the shared key never runs a paid model.
const free = findModel('gemini-3.6-flash');
const paid = findModel('gemini-3.6-pro');
assert.ok(free && paid);
assert.ok(canRun(free, { own: [], server: ['google'] }));
assert.ok(!canRun(paid, { own: [], server: ['google'] }));
assert.ok(canRun(paid, { own: ['google'], server: [] }));
assert.ok(!canRun(free, { own: [], server: [] }));

console.log('ALL PASS');

/**
 * Measures how well summaries catch breaking changes.
 * Run with `pnpm eval`.
 *
 * Each case in eval/cases.json is a release body with a hand-assigned `breaking` label.
 * The case runs through the real `summarizeRelease`, with the same prompt and schema the app uses, and the output counts as "breaking" if any change has type `breaking`.
 *
 * Recall is the number that matters: a missed breaking change is the expensive error, a false alarm only costs a closer look.
 *
 * pnpm eval              score every labelled case pnpm eval --export 20  write 20 real releases from the database to
 *                          eval/unlabelled.json, to label and move into cases
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { desc, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { releases, repos } from '@/db/schema';
import { serverAiContext } from '@/lib/ai';
import { summarizeRelease } from '@/lib/summarize';

const Case = z.object({
  id: z.string(),
  repo: z.string(),
  tag: z.string(),
  body: z.string(),
  breaking: z.boolean(),
  note: z.string().optional()
});

/** Free tiers are rate limited per minute; same spacing as the batch summarizer. */
const SPACING_MS = 1500;

/** Exit non-zero below this, so a prompt or model change that misses breaks fails loudly. */
const MIN_RECALL = 0.9;

function score(results: { expected: boolean; predicted: boolean }[]) {
  const tp = results.filter((r) => r.expected && r.predicted).length;
  const fp = results.filter((r) => !r.expected && r.predicted).length;
  const fn = results.filter((r) => r.expected && !r.predicted).length;
  const tn = results.filter((r) => !r.expected && !r.predicted).length;
  const ratio = (a: number, b: number) => (b === 0 ? 1 : a / b);
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  return {
    tp,
    fp,
    fn,
    tn,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    accuracy: ratio(tp + tn, results.length)
  };
}

async function exportUnlabelled(count: number) {
  const rows = await db
    .select({ repo: repos.owner, name: repos.name, tag: releases.tag, body: releases.bodyRaw })
    .from(releases)
    .innerJoin(repos, eq(repos.id, releases.repoId))
    .where(isNotNull(releases.bodyRaw))
    .orderBy(desc(releases.publishedAt))
    .limit(count);

  const cases = rows.map((r) => ({
    id: `${r.repo}-${r.name}-${r.tag}`,
    repo: `${r.repo}/${r.name}`,
    tag: r.tag,
    breaking: null,
    note: 'Label me: set breaking to true or false after reading the notes.',
    body: r.body ?? ''
  }));
  writeFileSync('eval/unlabelled.json', `${JSON.stringify(cases, null, 2)}\n`);
  console.log(
    `Wrote ${cases.length} releases to eval/unlabelled.json. Label them, then move them into eval/cases.json.`
  );
}

/** A failed call is not a prediction; leave it out of the score but say so. */
async function main() {
  const exportAt = process.argv.indexOf('--export');
  if (exportAt !== -1) return exportUnlabelled(Number(process.argv[exportAt + 1] ?? 20));

  const cases = z.array(Case).parse(JSON.parse(readFileSync('eval/cases.json', 'utf8')));
  const ai = serverAiContext();
  console.log(`Evaluating ${cases.length} cases on ${ai.modelId}\n`);

  const results: { id: string; expected: boolean; predicted: boolean; note?: string; reason: string }[] = [];
  for (const [i, c] of cases.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, SPACING_MS));
    try {
      const { output, modelId } = await summarizeRelease({ repo: c.repo, tag: c.tag, body: c.body }, ai);
      const breaking = output.changes.filter((change) => change.type === 'breaking');
      const predicted = breaking.length > 0;
      results.push({
        id: c.id,
        expected: c.breaking,
        predicted,
        note: c.note,
        reason: breaking[0]?.description ?? output.headline
      });
      console.log(`${predicted === c.breaking ? 'ok  ' : 'MISS'} ${c.id}  (${modelId})`);
    } catch (err) {
      console.log(`ERR  ${c.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const s = score(results);
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  console.log(`\nScored ${results.length}/${cases.length}`);
  console.log(`recall    ${pct(s.recall)}  (breaking changes caught: ${s.tp}/${s.tp + s.fn})`);
  console.log(`precision ${pct(s.precision)}  (breaking flags that were right: ${s.tp}/${s.tp + s.fp})`);
  console.log(`f1        ${pct(s.f1)}   accuracy ${pct(s.accuracy)}`);

  const wrong = results.filter((r) => r.expected !== r.predicted);
  if (wrong.length > 0) {
    console.log('\nMisses');
    for (const r of wrong) {
      console.log(
        `- ${r.id}: expected ${r.expected ? 'breaking' : 'not breaking'}, model said ${r.predicted ? 'breaking' : 'not breaking'}`
      );
      if (r.note) console.log(`    why it is labelled so: ${r.note}`);
      console.log(`    model: ${r.reason}`);
    }
  }

  if (s.recall < MIN_RECALL) {
    console.log(`\nRecall below ${pct(MIN_RECALL)}: failing.`);
    process.exitCode = 1;
  }
  if (results.length < cases.length) {
    console.log('\nSome cases errored (usually quota): the score is partial, not a pass.');
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode ?? 0));

import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { releases, repos, stackRepos, summaries, userPreferences, users } from '@/db/schema';
import { ReleaseSummary } from '@/lib/summarize';

/** How far back a digest looks when nothing has ever been sent. */
const DEFAULT_WINDOW_DAYS = 7;

/** Keep one email readable rather than exhaustive; the app has the full feed. */
const MAX_ENTRIES = 25;
const MAX_CHANGES_PER_RELEASE = 4;

const TYPE_COLOR: Record<string, string> = {
  breaking: '#b91c1c',
  deprecation: '#b45309',
  feature: '#00786f',
  fix: '#57534e',
  perf: '#57534e'
};

export type DigestEntry = {
  repo: string;
  tag: string;
  publishedAt: Date;
  headline: string;
  upgradeEffort: ReleaseSummary['upgradeEffort'];
  changes: ReleaseSummary['changes'];
};

export type BuiltDigest = {
  subject: string;
  html: string;
  text: string;
  entries: DigestEntry[];
  repoCount: number;
  breakingCount: number;
  since: Date;
};

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll(String.fromCharCode(39), '&#39;');
}

function appUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'http://localhost:3000';
  return base.startsWith('http') ? base : `https://${base}`;
}

/**
 * Everything released in the window across the user's stack, newest first.
 *
 * Only summarized releases make it in. An unsummarized release has nothing to
 * say yet, and shipping the raw changelog body would defeat the point.
 */
export async function buildDigest(userId: string, options: { since?: Date } = {}): Promise<BuiltDigest | null> {
  const since = options.since ?? new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const stack = await db.select({ repoId: stackRepos.repoId }).from(stackRepos).where(eq(stackRepos.userId, userId));

  const repoIds = stack.map((row) => row.repoId);
  if (repoIds.length === 0) return null;

  const rows = await db
    .select({
      owner: repos.owner,
      name: repos.name,
      tag: releases.tag,
      publishedAt: releases.publishedAt,
      data: summaries.data
    })
    .from(releases)
    .innerJoin(repos, eq(repos.id, releases.repoId))
    .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
    .where(and(inArray(releases.repoId, repoIds), isNotNull(releases.publishedAt), gte(releases.publishedAt, since)))
    .orderBy(desc(releases.publishedAt))
    .limit(200);

  const entries: DigestEntry[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    // One body hash can back several summary rows; one line per release is enough.
    const key = `${row.owner}/${row.name}@${row.tag}`;
    if (seen.has(key)) continue;

    const parsed = ReleaseSummary.safeParse(row.data);
    if (!parsed.success || !row.publishedAt) continue;

    seen.add(key);
    entries.push({
      repo: `${row.owner}/${row.name}`,
      tag: row.tag,
      publishedAt: row.publishedAt,
      headline: parsed.data.headline,
      upgradeEffort: parsed.data.upgradeEffort,
      changes: parsed.data.changes
    });
  }

  if (entries.length === 0) return null;

  const repoCount = new Set(entries.map((entry) => entry.repo)).size;
  const breakingCount = entries.filter((entry) => entry.changes.some((change) => change.type === 'breaking')).length;

  const summary =
    breakingCount > 0
      ? `${entries.length} releases, ${breakingCount} breaking`
      : `${entries.length} releases across ${plural(repoCount, 'repo')}`;

  return {
    subject: `Upstream: ${summary}`,
    html: renderHtml(entries, { breakingCount, repoCount, since }),
    text: renderText(entries, since),
    entries,
    repoCount,
    breakingCount,
    since
  };
}

/**
 * Inline styles and a table wrapper, because that is what mail clients
 * reliably render. Every interpolated string is escaped: release bodies and
 * model output are both untrusted input.
 */
function renderHtml(entries: DigestEntry[], meta: { breakingCount: number; repoCount: number; since: Date }) {
  const font = '-apple-system,Segoe UI,sans-serif';

  const items = entries
    .slice(0, MAX_ENTRIES)
    .map((entry) => {
      const breaking = entry.changes.some((change) => change.type === 'breaking');
      const changes = entry.changes
        .slice(0, MAX_CHANGES_PER_RELEASE)
        .map((change) => {
          const color = TYPE_COLOR[change.type] ?? '#57534e';
          return `<li style="margin:0 0 4px"><span style="color:${color};font-weight:600">${escapeHtml(change.type)}</span> &middot; ${escapeHtml(change.description)}</li>`;
        })
        .join('');

      const badge = breaking
        ? '<span style="background:#fee2e2;color:#b91c1c;font-size:11px;padding:2px 6px;border-radius:4px;margin-left:4px">breaking</span>'
        : '';

      return `<tr><td style="padding:16px 0;border-bottom:1px solid #e7e5e4">
  <div style="font:600 15px/1.4 ${font};color:#1c1917">${escapeHtml(entry.repo)} <span style="font-weight:400;color:#78716c">${escapeHtml(entry.tag)}</span>${badge}</div>
  <div style="font:400 14px/1.5 ${font};color:#57534e;margin:4px 0 8px">${escapeHtml(entry.headline)}</div>
  <ul style="font:400 13px/1.5 ${font};color:#44403c;margin:0;padding-left:18px">${changes}</ul>
  <div style="font:400 12px/1.5 ${font};color:#a8a29e;margin-top:6px">upgrade effort: ${escapeHtml(entry.upgradeEffort)}</div>
</td></tr>`;
    })
    .join('');

  const more =
    entries.length > MAX_ENTRIES
      ? `<p style="font:400 13px/1.5 ${font};color:#78716c">and ${entries.length - MAX_ENTRIES} more in the app.</p>`
      : '';

  const breakingNote = meta.breakingCount > 0 ? ` &middot; ${meta.breakingCount} breaking` : '';

  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#fafaf9">
<table role="presentation" style="max-width:600px;margin:0 auto;width:100%;border-collapse:collapse">
<tr><td>
  <div style="font:600 18px/1.3 ${font};color:#00786f">Upstream</div>
  <div style="font:400 14px/1.5 ${font};color:#78716c;margin-top:4px">${plural(entries.length, 'release')} across ${plural(meta.repoCount, 'repo')} since ${escapeHtml(meta.since.toDateString())}${breakingNote}</div>
</td></tr>
${items}
<tr><td style="padding-top:20px">
  ${more}
  <a href="${appUrl()}/digest" style="font:600 14px/1 ${font};color:#00786f;text-decoration:none">Open the full digest &rarr;</a>
  <p style="font:400 12px/1.5 ${font};color:#a8a29e;margin-top:16px"><a href="${appUrl()}/settings?section=digest" style="color:#a8a29e">Change frequency or turn this off</a></p>
</td></tr>
</table>
</body></html>`;
}

function renderText(entries: DigestEntry[], since: Date) {
  const lines = [`Upstream - ${plural(entries.length, 'release')} since ${since.toDateString()}`, ''];

  for (const entry of entries.slice(0, MAX_ENTRIES)) {
    lines.push(`${entry.repo} ${entry.tag}`, `  ${entry.headline}`);
    for (const change of entry.changes.slice(0, MAX_CHANGES_PER_RELEASE)) {
      lines.push(`  - [${change.type}] ${change.description}`);
    }
    lines.push(`  upgrade effort: ${entry.upgradeEffort}`, '');
  }

  lines.push(`${appUrl()}/digest`);
  return lines.join('\n');
}

/** Thrown when delivery cannot even be attempted, so callers can say why. */
export class DigestDeliveryError extends Error {}

export function mailProviderConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Resend over plain fetch. A mail SDK would be one more dependency for one HTTP
 * call, and this REST shape is stable.
 */
export async function deliver(message: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new DigestDeliveryError('No mail provider configured. Set RESEND_API_KEY to send digests.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM ?? 'Upstream <onboarding@resend.dev>',
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new DigestDeliveryError(`Resend refused the message (${response.status}). ${detail.slice(0, 200)}`.trim());
  }

  const body = (await response.json().catch(() => ({}))) as { id?: string };
  return { id: body.id ?? null };
}

/** The address a digest goes to: the override, else the GitHub account email. */
export async function resolveDigestEmail(userId: string) {
  const [row] = await db
    .select({ override: userPreferences.digestEmail, account: users.email })
    .from(users)
    .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  return row?.override?.trim() || row?.account?.trim() || null;
}

/**
 * Build and send in one step. Used by both the cron tick and the Send now
 * button, so a manual send is a genuine rehearsal of the scheduled one rather
 * than a second code path that can drift.
 */
export async function sendDigestToUser(userId: string, options: { since?: Date } = {}) {
  const to = await resolveDigestEmail(userId);
  if (!to) {
    throw new DigestDeliveryError('No email address on file. Add one in settings.');
  }

  const digest = await buildDigest(userId, options);
  if (!digest) return { sent: false as const, reason: 'nothing-new' as const, to };

  const result = await deliver({ to, subject: digest.subject, html: digest.html, text: digest.text });

  return {
    sent: true as const,
    to,
    id: result.id,
    entries: digest.entries.length,
    breaking: digest.breakingCount
  };
}

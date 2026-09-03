<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Upstream

A GitHub release digest. Tracks repos a user puts in their **stack**, ingests
releases, summarizes them with an LLM into structured data, rates the project,
and renders a readable digest.

Built as a portfolio project. Optimizing for demonstrable engineering judgment,
not feature count.

## Product shape

- Sign-in required. Everything except the landing page is behind `requireUser()`.
- Repos are a **shared catalogue**; each user's **stack** is their own slice of it.
- The digest answers: what changed, what's breaking, how much work the upgrade is.
- Each repo has its own page: rating, AI guide, alternatives, release history.

### Vocabulary

- **Stack** - the repos a user follows. Deliberately not "watching" or "tracking":
  those words belong to GitHub and mean something else there.
- **Catalogue** - the shared `repos` table. Visiting a repo page adds it to the
  catalogue but not to anyone's stack.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript strict
- Neon (Postgres) via Drizzle ORM 0.45 - `drizzle-orm/neon-http`
- Tailwind v4 + shadcn/ui (`base-nova` style, built on **base-ui**, not Radix)
- Auth.js v5 (next-auth) with GitHub OAuth, JWT sessions
- Vercel AI SDK - Google, Groq, Mistral, OpenRouter
- Zod for boundary validation
- Biome for lint + format (not ESLint/Prettier)
- pnpm, Node 22, deployed on Vercel

No Redis, no queues, no Docker, no monorepo. Adding infra this project doesn't
need is a negative signal.

## Layout

```
app/
  page.tsx              # dashboard, or <Landing/> when signed out
  digest/               # release feed with filters
  stack/                # the user's stack table
  repositories/         # owned / watched / starred / search on GitHub
  repos/[owner]/[name]/ # per-repo report
  search/               # stack + releases + GitHub
  settings/             # ?section= driven panels
  api/auth/[...nextauth]/
  api/cron/ingest/      # scheduled run, CRON_SECRET bearer
  actions.ts            # every server action
components/
  ui/                   # shadcn primitives - generated, do not hand-edit
db/                     # schema, client, seed
lib/                    # ai, github, ingest, summarize, rating, sync, crypto
scripts/                # ingest, summarize, sync CLIs
```

Path alias is `@/*` -> `./*`.

## Data model

**Shared** (survive account deletion):

- `repos` - `owner`, `name`, plus GitHub metadata: `description`, `stars`,
  `forks`, `watchers`, `openIssues`, `pushedAt`, `archived`, `license`,
  `lastIngestedAt`. Unique on `(owner, name)`.
- `releases` - FK to repo, `githubReleaseId`, `tag`, `publishedAt`, `bodyRaw`,
  `bodyHash`. Unique on `(repoId, githubReleaseId)`.
- `summaries` - `bodyHash`, `instructionsHash`, `model`, `promptVersion`,
  `data` jsonb. Unique on `(bodyHash, instructionsHash)`.
- `repoGuides` - per repo + `instructionsHash`. The "explain this repo" output.
- `runs` - one row per ingestion run, scheduled or manual.

**Per user** (cascade from `users`):

- `users`, `accounts` (Auth.js)
- `stackRepos` - the user's stack. Unique on `(userId, repoId)`.
- `aiKeys` - one provider key per user, AES-256-GCM encrypted.
- `userInstructions` - per feature (`global`, `summary`, `guide`).
- `userPreferences` - digest email, opt-out, frequency/hour/weekday, model.

### Key design decision: hash-based dedupe

Summaries are keyed on `bodyHash` (sha256 of the release body), not release id.
Identical release notes across repos or re-runs get summarized once, ever. This
is what keeps the project inside free-tier LLM quota and is worth preserving.

`instructionsHash` extends it: `"default"` for instruction-free output everyone
shares, or a hash of the user's instructions when the output is personalised.
Users without instructions keep hitting the shared cache.

`model` and `promptVersion` are stored so stale rows can be regenerated.

## Conventions

- No non-null assertions (`!`). Narrow with an early `if (!x) continue;` or
  `throw`, and destructure before narrowing - TS does not preserve narrowing on
  properties across an `await`.
- Catch variables are `unknown`. Use an `errorMessage(err: unknown)` helper.
- Validate at boundaries. GitHub responses and jsonb read back from Postgres get
  parsed with Zod, not cast with `as`.
- Batch jobs catch per item. One bad repo must not kill the run.
- Inserts are idempotent - `onConflictDoNothing()` on DB-level constraints.
- Server components by default. `db` must never reach a client component.
- **Never import a value from a `"use client"` module into a server component.**
  It resolves to a client-reference proxy, not the value. This has caused two
  runtime 500s. Shared constants live in a plain `lib/` module; icons are matched
  to ids inside the client component.
- Long-running AI work goes in `after()` from `next/server`, never inline in a
  click. Toasts for both success and failure, via sonner.
- Every pending control sets `aria-busy`, which drives the wait cursor.
- Tooltips are shadcn's `Tooltip`, never a `title` attribute.
- Hyphens are `-`. No em or en dashes in source or copy.

## shadcn/ui

Prefer an existing shadcn component over hand-rolling: `Empty` for empty states,
`Spinner`, `Kbd`, `InputGroup`, `Item`, `Sheet`, `Tooltip`, `Field`.

`components/ui/**` is generated. Hand-edits are wiped the next time that
component is re-added - a `biome-ignore` there was lost exactly that way, which
is why the a11y exceptions for that directory live in `biome.json` `overrides`.

## Scripts

```
pnpm dev
pnpm db:push        # drizzle-kit push (no migration files yet; solo project)
pnpm db:seed
pnpm ingest         # fetch releases for every catalogue repo
pnpm summarize      # summarize un-summarized releases, batched
pnpm sync           # a full manual run, recorded in `runs`
pnpm typecheck      # tsc --noEmit
pnpm lint           # biome check
pnpm format         # biome format --write
```

Scripts run through `tsx --env-file=.env` because tsx does not load Next's env
files automatically. Node's `--env-file` is used rather than `dotenv/config`
because ES import hoisting causes `db/index.ts` to read `process.env` before any
in-file dotenv call executes.

Env vars are documented in `.env.example`.

## GitHub notes

- Public repos only. No write scopes, no private repos.
- **OAuth tokens expire.** The app is configured with 8-hour access tokens;
  `getGitHubToken()` refreshes with the stored refresh token when `expires_at`
  has passed. Without that, every user-scoped call 401s hours after sign-in.
- User-scoped endpoints (`/user/repos`, `/user/subscriptions`) must NOT fall back
  to the server PAT - it belongs to a different account and would show the wrong
  repos. Public lookups may fall back.
- `draft` releases are filtered out. Prereleases are kept.
- GitHub's "used by" (dependents) count is not in the REST API, only on the
  dependency-graph HTML page. The rating deliberately omits it.

## AI notes

- Structured output via `generateText` with the `output` setting (not
  `generateObject`). Zod `.describe()` materially improves output - keep it.
- Free tiers are **rate limited per minute and per day**, not unlimited. Calls are
  spaced 1.5s apart, and BYOK exists so users can run on their own quota.
- Model ids go stale. `gemini-2.5-flash` was retired mid-project and broke every
  summary silently. Keys and models are probed with a live call before saving.
- The "needs summarizing" query is a left join from `releases` to `summaries` on
  `(bodyHash, instructionsHash)` with `isNull(summaries.id)` - a SQL anti-join.
  A run cut short simply resumes.

## Scheduling

Vercel Cron is project-level and cannot fire per user. `/api/cron/ingest` runs
hourly; `isDigestDue()` decides whose digest is due this tick from their own
frequency, weekday and UTC hour. `CRON_SECRET` must be set in Vercel too.

Digest **delivery is not implemented** - no mail provider is wired. The schedule
is stored and the due-check runs, but nothing is sent.

## Status

Done: ingestion, hash-deduped summarization, auth, per-user stacks, digest with
filters, repo pages with ratings/guides/alternatives, BYOK multi-provider, search,
scheduled runs with a `runs` log, account erase.

Not done:

- Email delivery for the digest
- Eval harness (hand-labelled releases + accuracy score)
- Playwright E2E in CI. Note: Next 16 type checks everything the tsconfig
  includes during `next build`, so test files will fail production builds
- Read state (seen/unseen), so the bell count can mean "new since you looked"
- Non-GitHub-Release changelogs (`CHANGELOG.md`)
- Rate-limit backoff; `x-ratelimit-remaining` is logged but never acted on

## CI

GitHub Actions on push and PR: pnpm install, `next typegen`, `pnpm typecheck`,
`pnpm lint`. No build step (Vercel builds) and therefore no secrets in CI.

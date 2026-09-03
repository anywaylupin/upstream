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
- Vercel AI SDK - Google, Groq, Mistral, Anthropic, DeepSeek, xAI, OpenAI,
  OpenRouter
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
- `userPreferences` - digest email, opt-out, model, and the schedule:
  frequency, hour, IANA timezone, weekday, day-of-month, interval.

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
- **Same-route param changes should not round-trip.** Settings sections used to
  navigate `?section=`, which re-ran two GitHub calls and the whole page to swap
  a panel. The page renders every panel once and `SettingsShell` switches them
  on the client, keeping the URL honest with `history.replaceState`. The entries
  stay real anchors so ctrl-click still opens a section in a tab.
- **Every route segment has a `loading.tsx`.** Without one, Next blocks on the
  server before committing the transition and the tab simply looks frozen -
  which is exactly what happened here. `useLinkStatus` (in
  `components/link-pending.tsx`) covers the remaining gap by swapping a nav
  icon for a spinner; it must live in a descendant of the `<Link>`, and the
  pending phase is skipped entirely once a route is prefetched.
- Every pending control sets `aria-busy`, which drives the wait cursor.
- Tooltips are shadcn's `Tooltip`, never a `title` attribute. base-ui's
  `render` prop does not forward an `onClick` onto the element it renders, so a
  handler there silently never fires - the settings rail delegates from the
  `<nav>` instead.
- Provider brand marks are inlined SVG paths in `components/provider-icon.tsx`,
  taken from simple-icons and lobehub (both CC0). Neither package is a
  dependency: they were installed once to lift the paths, then removed.
- Every text input carries `name` and a real `type` (`email`, `url`, `search`,
  `number`), plus an explicit `autoComplete`. Search and secret fields opt out
  with `autoComplete="off"`; the digest address opts in with `email`.
- A control rendered conditionally still needs its value submitted. The custom
  interval renders a hidden `intervalDays` when its visible field is not shown,
  so exactly one field of that name always posts.
- Hyphens are `-`. No em or en dashes in source or copy.

## Theming

`--brand-h` and `--brand-c` (an OKLCH hue and chroma) drive every themed token,
so a palette is two numbers rather than a full set of colour variables. The 18
shadcn accent ramps live in `lib/theme.ts` and one `[data-theme]` block each in
`app/globals.css`. The swatches set `data-theme` on themselves so each renders
its own colour instead of inheriting the active one.

Mode and palette are applied by an inline script from the server layout before
first paint - see `lib/theme.ts`. Keeping it out of a client component is what
avoids React 19's "script tag while rendering" error.

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
pnpm ingest         # fetch releases for every catalogue repo
pnpm summarize      # summarize un-summarized releases, batched
pnpm sync           # a full manual run, recorded in `runs`
pnpm check:schedule # asserts the digest date maths (no env needed)
pnpm typecheck      # tsc --noEmit
pnpm lint           # biome check
pnpm format         # biome format --write
```

Scripts run through `tsx --env-file=.env` because tsx does not load Next's env
files automatically. Node's `--env-file` is used rather than `dotenv/config`
because ES import hoisting causes `db/index.ts` to read `process.env` before any
in-file dotenv call executes.

Env vars are documented in `.env.example`.

## Caching

React's `cache()` only dedupes within one request. The user-scoped GitHub reads
are wrapped in `unstable_cache` in `lib/github-cache.ts` with a 5 minute TTL and
a `github:<userId>` tag, so switching repository tabs stops re-hitting the API -
the starred list alone went from ~2.5s to ~0.6s.

The access token is deliberately not part of the cache key. It rotates every
eight hours, so keying on it would miss on every refresh and would write
short-lived credentials into cache keys. The key parts carry the user id.

`unstable_cache` is deprecated in Next 16 in favour of `use cache`, but that
needs `cacheComponents: true`, which changes prerendering for the whole app.
Not worth it for five calls.

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
- `lib/ai-models.ts` is the catalogue - pure and client-safe, no `db` and no
  `process.env`. Each model carries a `tier`: `free` means a recurring
  allowance that refills, not a trial.
- A provider is offered only when there is a key to run it with: `serverKeyFor()`
  (its env var) or the user's own stored key. Providers with neither are hidden
  from the picker but stay reachable in the "Add an API key" dialog, which is
  how BYOK unlocks them. Listing a model that cannot run is worse than omitting
  it.
- `serverKeyFor()` writes the env vars out statically. Bundlers inline
  `process.env.X` by literal name, so `process.env[provider.envVar]` quietly
  resolves to undefined in some builds.
- The key dialog's model select is keyed on the provider. Switching provider
  unmounts the selected item and base-ui resets its own value to null rather
  than to the new list's first entry, which rendered a literal "null" in the
  trigger. Remounting re-seeds it.
- The "needs summarizing" query is a left join from `releases` to `summaries` on
  `(bodyHash, instructionsHash)` with `isNull(summaries.id)` - a SQL anti-join.
  A run cut short simply resumes.

## Scheduling and delivery

Vercel Cron is project-level and cannot fire per user. `/api/cron/ingest` runs
hourly; `isDigestDue()` decides whose digest is due this tick. That hourly tick
is the precision limit - there is no point offering minutes.

Frequencies are `daily`, `weekly`, `biweekly`, `monthly` and `custom` (every N
days). `biweekly` and `custom` need no anchor column: the weekday pins the day
and the gap since `lastDigestAt` pins the week. Monthly is capped at day 28 so
every month actually has the date.

The hour is read in the user's own IANA zone, so the maths lives in
`lib/digest-schedule.ts` - deliberately free of any `db` import so the settings
form (a client component) can share the constants and render a live "next run".
`nextDigestAt()` predicts by walking candidates and reusing `isDigestDue()`, so
the prediction cannot drift from the rule the cron applies.

Two bugs worth not reintroducing, both covered by `pnpm check:schedule`:

- Correcting a wall-clock guess must measure the error against the **target**,
  not the running guess, or each pass re-subtracts the UTC offset and the second
  pass undoes the first.
- The correction must be to the **minute**. Whole hours put `Asia/Kolkata`
  (+05:30) and `Pacific/Chatham` (+12:45) half an hour late.

Delivery goes through Resend over plain `fetch` (`lib/digest-email.ts`) - a mail
SDK would be a dependency for one HTTP call. Without `RESEND_API_KEY` the app
still ingests, summarizes and renders the digest; only sending is off, and it
says so rather than failing silently. `CRON_SECRET` must be set in Vercel too.

`sendDigestNow()` (the Send now button) runs the same `sendDigestToUser()` path
as the cron, so a manual send is a rehearsal of the scheduled one rather than a
second code path that can drift. It deliberately does **not** touch
`lastDigestAt` - a test send should not push the next scheduled one out a cycle.
Release bodies and model output are both untrusted, so every value interpolated
into the email HTML is escaped.

## Status

Done: ingestion, hash-deduped summarization, auth, per-user stacks, digest with
filters, repo pages with ratings/guides/alternatives, BYOK multi-provider, search,
scheduled runs with a `runs` log, account erase, per-user digest schedules and
email delivery.

Not done:

- Eval harness (hand-labelled releases + accuracy score)
- Playwright E2E in CI. Note: Next 16 type checks everything the tsconfig
  includes during `next build`, so test files will fail production builds
- Read state (seen/unseen), so the bell count can mean "new since you looked"
- Non-GitHub-Release changelogs (`CHANGELOG.md`)
- Rate-limit backoff; `x-ratelimit-remaining` is logged but never acted on

## CI

GitHub Actions on push and PR: pnpm install, `next typegen`, `pnpm typecheck`,
`pnpm lint`. No build step (Vercel builds) and therefore no secrets in CI.

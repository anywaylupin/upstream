<div align="center">

<img src="app/icon.svg" width="72" height="72" alt="" />

# Upstream

**Release intel for the repos you depend on.**

Upstream reads every changelog in your stack, flags what breaks, estimates the
upgrade effort and rates the project.

</div>

---

## What it does

- **Digest** - every release across your stack, summarized into what changed,
  what breaks and how much work the upgrade is.
- **Breaking radar** - breaking changes and deprecations surfaced first.
- **Repo reports** - a five-part rating, an AI guide to the project, and
  alternatives lined up against it.
- **Your key, your model** - bring a key for any of eight providers, or run on
  the shared one.
- **On your schedule** - daily, weekly, biweekly, monthly or every N days, in
  your own time zone, delivered by email.

## Stack

| Tech | Why |
| --- | --- |
| ![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white) | App Router, server components |
| ![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=000000) | UI |
| ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white) | No `any`, no non-null assertions |
| ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) | Styling |
| ![shadcn/ui](https://img.shields.io/badge/shadcn/ui-base--nova-000000?style=flat-square&logo=shadcnui&logoColor=white) | Components, built on Base UI |
| ![Drizzle](https://img.shields.io/badge/Drizzle-0.45-C5F74F?style=flat-square&logo=drizzle&logoColor=000000) | ORM |
| ![Neon](https://img.shields.io/badge/Neon-Postgres-00E599?style=flat-square&logo=neon&logoColor=000000) | Serverless Postgres |
| ![Auth.js](https://img.shields.io/badge/Auth.js-v5-000000?style=flat-square&logo=auth0&logoColor=white) | GitHub OAuth, JWT sessions |
| ![Vercel AI SDK](https://img.shields.io/badge/AI_SDK-7-000000?style=flat-square&logo=vercel&logoColor=white) | Structured LLM output |
| ![Zod](https://img.shields.io/badge/Zod-4-3E67B1?style=flat-square&logo=zod&logoColor=white) | Boundary validation |
| ![Biome](https://img.shields.io/badge/Biome-2.4-60A5FA?style=flat-square&logo=biome&logoColor=white) | Lint and format |
| ![pnpm](https://img.shields.io/badge/pnpm-Node_22-F69220?style=flat-square&logo=pnpm&logoColor=white) | Package manager |
| ![Vercel](https://img.shields.io/badge/Vercel-deploy_+_cron-000000?style=flat-square&logo=vercel&logoColor=white) | Hosting and scheduling |

No Redis, no queues, no Docker, no monorepo.

## Quick start

```bash
pnpm install
cp .env.example .env   # then fill it in
pnpm db:push
pnpm dev
```

Every variable is documented in [`.env.example`](.env.example), including how
to obtain each key. The minimum to boot: `DATABASE_URL`, `AUTH_SECRET`, a
GitHub OAuth app, and one AI provider key.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm db:push` | Push the schema to Neon |
| `pnpm ingest` | Fetch releases for every catalogue repo |
| `pnpm summarize` | Summarize un-summarized releases |
| `pnpm sync` | A full manual run, recorded in `runs` |
| `pnpm check:schedule` | Assert the digest date maths |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | `biome check` |

## How it works

**Summaries are deduped by content hash.** A summary is keyed on the sha256 of
the release body, not the release id, so identical notes across repos or re-runs
are summarized once, ever. That is what keeps the project inside free-tier LLM
quota.

**Repos are a shared catalogue; a stack is one user's slice of it.** Ingestion
and summary dedupe stay global while every view is scoped to the person asking.

**The cron tick is project-wide, the schedule is per user.** Vercel Cron cannot
fire per user, so `/api/cron/ingest` runs hourly and `isDigestDue()` decides
whose digest is due, reading the hour in each user's own IANA zone.

**Model ids are never trusted.** `gemini-2.5-flash` was retired mid-project and
broke every summary silently. Keys and models are now probed with a live call
before they are saved.

More detail, and the traps worth not reintroducing, live in
[`AGENTS.md`](AGENTS.md).

## Status

Working: ingestion, summarization, auth, per-user stacks, digest with filters,
repo reports, BYOK across eight providers, search, scheduled runs, email
delivery, account erase.

Not built yet: an eval harness, Playwright E2E, read state, non-GitHub-Release
changelogs, and rate-limit backoff.

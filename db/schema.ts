import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique
} from 'drizzle-orm/pg-core';
import type { DigestFrequency } from '@/lib/digest-schedule';

export const repos = pgTable(
  'repos',
  {
    id: serial('id').primaryKey(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    stars: integer('stars'),
    forks: integer('forks'),
    watchers: integer('watchers'),
    openIssues: integer('open_issues'),
    pushedAt: timestamp('pushed_at'),
    archived: boolean('archived'),
    license: text('license'),
    lastIngestedAt: timestamp('last_ingested_at'),
    addedAt: timestamp('added_at').defaultNow().notNull()
  },
  (t) => [unique().on(t.owner, t.name)]
);

export const releases = pgTable(
  'releases',
  {
    id: serial('id').primaryKey(),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repos.id),
    githubReleaseId: bigint('github_release_id', { mode: 'number' }).notNull(),
    tag: text('tag').notNull(),
    publishedAt: timestamp('published_at'),
    bodyRaw: text('body_raw'),
    bodyHash: text('body_hash'),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (t) => [unique().on(t.repoId, t.githubReleaseId), index('releases_published_at_idx').on(t.publishedAt)]
);

export const summaries = pgTable(
  'summaries',
  {
    id: serial('id').primaryKey(),
    bodyHash: text('body_hash').notNull(),
    // "default" for the shared, instruction-free summary everyone reuses;
    // a hash of the user's AI instructions when the output is personalised.
    instructionsHash: text('instructions_hash').notNull().default('default'),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (t) => [unique().on(t.bodyHash, t.instructionsHash)]
);

export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;

// Auth.js (next-auth v5) tables. Session strategy is JWT, so no sessions or
// verificationTokens table is needed - the adapter only handles user/account linking.
export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified'),
  image: text('image')
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<'oauth' | 'oidc' | 'email' | 'webauthn'>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state')
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

/** The repos a user has put in their stack. Deliberately not "watching":
 * that word belongs to GitHub and means something else. */
export const stackRepos = pgTable(
  'stack_repos',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (t) => [unique().on(t.userId, t.repoId)]
);

// "What is this repo / how do I use it" guides. Keyed on repoId, with the
// README hash stored so a stale guide can be regenerated when the README moves on.
export const repoGuides = pgTable(
  'repo_guides',
  {
    id: serial('id').primaryKey(),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    instructionsHash: text('instructions_hash').notNull().default('default'),
    readmeHash: text('readme_hash').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (t) => [unique().on(t.repoId, t.instructionsHash)]
);

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  aiInstructions: text('ai_instructions'),
  /** Encrypted at rest; never sent to the client. */
  googleApiKey: text('google_api_key'),
  googleApiKeyHint: text('google_api_key_hint'),
  /** provider model id, e.g. "gemini-3.6-flash". Null uses the server default. */
  aiModel: text('ai_model'),
  /** Where digests go. Defaults to the GitHub account email. */
  digestEmail: text('digest_email'),
  digestEnabled: boolean('digest_enabled').notNull().default(true),
  digestFrequency: text('digest_frequency').$type<DigestFrequency>().notNull().default('weekly'),
  /** Hour 0-23, read in `digestTimezone`. Cron ticks hourly and picks up whoever is due. */
  digestHour: integer('digest_hour').notNull().default(7),
  /** 0 = Sunday. Used by the weekly and biweekly frequencies. */
  digestWeekday: integer('digest_weekday').notNull().default(1),
  /** IANA zone the hour above is read in, e.g. "Asia/Bangkok". */
  digestTimezone: text('digest_timezone').notNull().default('UTC'),
  /** 1-28, used by the monthly frequency. Capped so every month has the date. */
  digestDayOfMonth: integer('digest_day_of_month').notNull().default(1),
  /** Gap in days, used by the custom frequency. */
  digestIntervalDays: integer('digest_interval_days').notNull().default(14),
  lastDigestAt: timestamp('last_digest_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/** One provider key per user. Encrypted; the hint is the only part shown back. */
export const aiKeys = pgTable(
  'ai_keys',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    encryptedKey: text('encrypted_key').notNull(),
    hint: text('hint').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (t) => [unique().on(t.userId, t.provider)]
);

/**
 * Instructions are per feature, so "explain repos like I'm new to the stack"
 * does not also rewrite every release summary.
 */
export const userInstructions = pgTable(
  'user_instructions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feature: text('feature').notNull(),
    text: text('text').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (t) => [unique().on(t.userId, t.feature)]
);

/**
 * One row per ingestion run, scheduled or manual. This is where the real cost
 * and cache-hit numbers for the README come from.
 */
export const runs = pgTable(
  'runs',
  {
    id: serial('id').primaryKey(),
    trigger: text('trigger').$type<'cron' | 'manual'>().notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    finishedAt: timestamp('finished_at'),
    repos: integer('repos').notNull().default(0),
    releasesFetched: integer('releases_fetched').notNull().default(0),
    releasesNew: integer('releases_new').notNull().default(0),
    summarized: integer('summarized').notNull().default(0),
    errors: integer('errors').notNull().default(0),
    note: text('note')
  },
  (t) => [index('runs_started_at_idx').on(t.startedAt)]
);

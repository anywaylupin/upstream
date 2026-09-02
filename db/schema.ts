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
  unique,
} from "drizzle-orm/pg-core";

export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    stars: integer("stars"),
    forks: integer("forks"),
    watchers: integer("watchers"),
    openIssues: integer("open_issues"),
    pushedAt: timestamp("pushed_at"),
    archived: boolean("archived"),
    license: text("license"),
    lastIngestedAt: timestamp("last_ingested_at"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.owner, t.name)],
);

export const releases = pgTable(
  "releases",
  {
    id: serial("id").primaryKey(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id),
    githubReleaseId: bigint("github_release_id", { mode: "number" }).notNull(),
    tag: text("tag").notNull(),
    publishedAt: timestamp("published_at"),
    bodyRaw: text("body_raw"),
    bodyHash: text("body_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.repoId, t.githubReleaseId),
    index("releases_published_at_idx").on(t.publishedAt),
  ],
);

export const summaries = pgTable("summaries", {
  id: serial("id").primaryKey(),
  bodyHash: text("body_hash").notNull().unique(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;

// Auth.js (next-auth v5) tables. Session strategy is JWT, so no sessions or
// verificationTokens table is needed - the adapter only handles user/account linking.
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type")
      .$type<"oauth" | "oidc" | "email" | "webauthn">()
      .notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

/** The repos a user has put in their stack. Deliberately not "watching":
 * that word belongs to GitHub and means something else. */
export const stackRepos = pgTable(
  "stack_repos",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.repoId)],
);

// "What is this repo / how do I use it" guides. Keyed on repoId, with the
// README hash stored so a stale guide can be regenerated when the README moves on.
export const repoGuides = pgTable("repo_guides", {
  id: serial("id").primaryKey(),
  repoId: integer("repo_id")
    .notNull()
    .unique()
    .references(() => repos.id, { onDelete: "cascade" }),
  readmeHash: text("readme_hash").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  aiInstructions: text("ai_instructions"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

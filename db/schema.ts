import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
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

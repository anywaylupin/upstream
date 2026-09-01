import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

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

export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;

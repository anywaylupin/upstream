import { and, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import {
  ArrowRightIcon,
  ClockIcon,
  LayersIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Landing } from "@/components/landing";
import { RatingBadge } from "@/components/rating-badge";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { releases, repos, stackRepos, summaries } from "@/db/schema";
import { formatRelative } from "@/lib/format";
import { rateRepo } from "@/lib/repo-rating";
import { getStackStats, WINDOW_DAYS, windowStart } from "@/lib/repo-stats";
import { ReleaseSummary } from "@/lib/summarize";

function SectionHeading({
  icon: Icon,
  children,
  href,
  linkLabel,
}: {
  icon: typeof ClockIcon;
  children: ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {children}
      </h2>
      {href && (
        <Link
          href={href}
          className="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {linkLabel}
          <ArrowRightIcon className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export default async function Dashboard() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <Landing />;

  const stack = await db
    .select({ repoId: stackRepos.repoId })
    .from(stackRepos)
    .where(eq(stackRepos.userId, userId));
  const repoIds = stack.map((row) => row.repoId);

  const [{ rows, totals }, latest] = await Promise.all([
    getStackStats(userId),
    repoIds.length
      ? db
          .select({
            releaseId: releases.id,
            tag: releases.tag,
            owner: repos.owner,
            name: repos.name,
            data: summaries.data,
          })
          .from(releases)
          .innerJoin(repos, eq(repos.id, releases.repoId))
          .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
          .where(
            and(
              inArray(releases.repoId, repoIds),
              isNotNull(releases.publishedAt),
              gte(releases.publishedAt, windowStart()),
            ),
          )
          .orderBy(desc(releases.publishedAt))
          .limit(6)
      : Promise.resolve([]),
  ]);

  const lastSync = rows
    .map((row) => row.lastIngestedAt)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  // The full table lives on /repos; the dashboard only surfaces what needs a look.
  const attention = rows
    .map((row) => ({
      row,
      rating: rateRepo(row),
    }))
    .sort(
      (a, b) =>
        b.row.breaking30d - a.row.breaking30d ||
        a.rating.overall - b.rating.overall,
    )
    .slice(0, 4);

  return (
    <div className="flex w-full flex-col gap-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClockIcon className="size-3.5" />
          synced {formatRelative(lastSync ?? null)}
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={LayersIcon} label="Stack" value={totals.repos} />
        <StatTile
          icon={TagIcon}
          label={`Releases ${WINDOW_DAYS}d`}
          value={totals.releases30d}
          delay={60}
        />
        <StatTile
          icon={ShieldAlertIcon}
          tone={totals.breaking30d > 0 ? "danger" : "default"}
          label={`Breaking ${WINDOW_DAYS}d`}
          value={totals.breaking30d}
          hint={totals.breaking30d > 0 ? "needs a plan" : "all clear"}
          delay={120}
        />
        <StatTile
          icon={SparklesIcon}
          label="Summarized"
          value={totals.summariesCached}
          delay={180}
        />
      </div>

      {attention.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHeading
            icon={LayersIcon}
            href="/stack"
            linkLabel="Full stack"
          >
            Needs a look
          </SectionHeading>

          <ul className="grid gap-3 lg:grid-cols-2">
            {attention.map(({ row, rating }, i) => (
              <li
                key={row.repoId}
                style={{ animationDelay: `${i * 50}ms` }}
                className="lift animate-rise rounded-lg p-4 ring-1 ring-foreground/10 hover:ring-primary/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/repos/${row.owner}/${row.name}`}
                    className="text-sm font-medium transition-colors hover:text-primary hover:underline"
                  >
                    {row.owner}/{row.name}
                  </Link>
                  <RatingBadge rating={rating} />
                  {row.breaking30d > 0 && (
                    <Badge variant="destructive">
                      {row.breaking30d} breaking
                    </Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {row.releases30d} in {WINDOW_DAYS}d
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.description ?? "No description yet."}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {latest.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionHeading icon={ClockIcon} href="/digest" linkLabel="Digest">
            Latest releases
          </SectionHeading>

          <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {latest.map((row, i) => {
              const parsed = ReleaseSummary.safeParse(row.data);
              const hasBreaking =
                parsed.success &&
                parsed.data.changes.some((c) => c.type === "breaking");

              return (
                <li
                  key={row.releaseId}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className={`lift animate-rise flex flex-col gap-1 rounded-lg p-4 ring-1 ${
                    hasBreaking
                      ? "ring-destructive/50 hover:ring-destructive"
                      : "ring-foreground/10 hover:ring-primary/40"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`/repos/${row.owner}/${row.name}`}
                      className="text-sm font-medium transition-colors hover:text-primary hover:underline"
                    >
                      {row.owner}/{row.name}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.tag}
                    </span>
                    {hasBreaking && (
                      <Badge variant="destructive">breaking</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {parsed.success ? parsed.data.headline : "Pending"}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

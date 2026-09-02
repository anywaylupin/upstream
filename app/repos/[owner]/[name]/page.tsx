import { and, count, desc, eq, gte, inArray, isNotNull, or } from "drizzle-orm";
import {
  BookOpenIcon,
  ExternalLinkIcon,
  GaugeIcon,
  GitCompareIcon,
  PackageIcon,
  ShieldAlertIcon,
  StarIcon,
  TagIcon,
  TimerIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import {
  AlternativesCompare,
  type CompareRow,
} from "@/components/alternatives-compare";
import { GenerateGuideButton } from "@/components/generate-guide-button";
import { RatingBadge, RatingBars } from "@/components/rating-badge";
import { RefreshRepoButton } from "@/components/refresh-repo-button";
import { StackButton } from "@/components/stack-button";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { releases, repos, stackRepos, summaries } from "@/db/schema";
import { formatDate, formatRelative } from "@/lib/format";
import { getGitHubToken, getRepoMeta } from "@/lib/github";
import { rateRepo } from "@/lib/repo-rating";
import { getRatingInputs, WINDOW_DAYS, windowStart } from "@/lib/repo-stats";
import { requireUser } from "@/lib/session";
import {
  type ReleaseSummary,
  ReleaseSummary as ReleaseSummarySchema,
} from "@/lib/summarize";

const BADGE_VARIANT: Record<
  ReleaseSummary["changes"][number]["type"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  breaking: "destructive",
  feature: "default",
  fix: "secondary",
  perf: "outline",
  deprecation: "outline",
};

/** A repo Upstream has no releases for yet: GitHub facts plus a way to start. */
async function UntrackedRepo({
  owner,
  name,
  userId,
}: {
  owner: string;
  name: string;
  userId: string;
}) {
  const token = (await getGitHubToken(userId)) ?? process.env.GITHUB_TOKEN;
  if (!token) notFound();

  const meta = await getRepoMeta(owner, name, token).catch(() => null);
  if (!meta) notFound();

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
            {meta.full_name}
            <a
              href={meta.html_url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-primary"
              aria-label="Open on GitHub"
            >
              <ExternalLinkIcon className="size-4" />
            </a>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {meta.description ?? "No description."}
          </p>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <StarIcon className="size-3" />
            {meta.stargazers_count.toLocaleString()}
          </span>
        </div>
        <StackButton owner={owner} name={name} />
      </header>

      <div className="flex flex-col items-center gap-2 rounded-lg py-12 text-sm text-muted-foreground ring-1 ring-foreground/10">
        <PackageIcon className="size-6 opacity-60" />
        Not in your stack yet. Add it to pull releases and build its analytics.
      </div>
    </div>
  );
}

export default async function RepoReport({
  params,
}: {
  params: Promise<{ owner: string; name: string }>;
}) {
  const user = await requireUser();
  const { owner, name } = await params;

  const [repo] = await db
    .select()
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.name, name)));

  // Any repo gets a page, not just the ones already in a stack. If Upstream has
  // never seen it, fall back to GitHub metadata and offer to start tracking.
  if (!repo)
    return <UntrackedRepo owner={owner} name={name} userId={user.id} />;

  const since = windowStart();

  const [releaseRows, totalRows, windowRows, windowSummaries, ratingInputs] =
    await Promise.all([
      db
        .select({
          releaseId: releases.id,
          tag: releases.tag,
          publishedAt: releases.publishedAt,
          data: summaries.data,
        })
        .from(releases)
        .leftJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
        .where(eq(releases.repoId, repo.id))
        .orderBy(desc(releases.publishedAt))
        .limit(25),
      db
        .select({ total: count() })
        .from(releases)
        .where(eq(releases.repoId, repo.id)),
      db
        .select({ total: count() })
        .from(releases)
        .where(
          and(
            eq(releases.repoId, repo.id),
            isNotNull(releases.publishedAt),
            gte(releases.publishedAt, since),
          ),
        ),
      db
        .select({ data: summaries.data })
        .from(releases)
        .innerJoin(summaries, eq(summaries.bodyHash, releases.bodyHash))
        .where(
          and(
            eq(releases.repoId, repo.id),
            isNotNull(releases.publishedAt),
            gte(releases.publishedAt, since),
          ),
        ),
      getRatingInputs([repo.id]),
    ]);

  const self = ratingInputs.get(repo.id);
  const guide = self?.guide ?? null;
  const rating = self ? rateRepo(self) : null;

  const breaking30d = windowSummaries.filter((row) => {
    const parsed = ReleaseSummarySchema.safeParse(row.data);
    return (
      parsed.success &&
      parsed.data.changes.some((change) => change.type === "breaking")
    );
  }).length;

  // Resolve the alternatives the guide named against repos we already know about,
  // so anything tracked can be compared on the same rating scale.
  const alternatives = guide?.alternatives ?? [];
  const altPairs = alternatives
    .map((alt) => alt.repo.split("/"))
    .filter((parts): parts is [string, string] => parts.length === 2);

  const altRepoRows = altPairs.length
    ? await db
        .select({ id: repos.id, owner: repos.owner, name: repos.name })
        .from(repos)
        .where(
          or(
            ...altPairs.map(([o, n]) =>
              and(eq(repos.owner, o), eq(repos.name, n)),
            ),
          ),
        )
    : [];

  const altIds = altRepoRows.map((r) => r.id);
  const [altRatings, stackRows] = await Promise.all([
    getRatingInputs(altIds),
    db
      .select({ id: stackRepos.id, repoId: stackRepos.repoId })
      .from(stackRepos)
      .where(
        and(
          eq(stackRepos.userId, user.id),
          inArray(stackRepos.repoId, [repo.id, ...altIds]),
        ),
      ),
  ]);

  const stackIdByRepo = new Map(stackRows.map((w) => [w.repoId, w.id]));
  const altIdByFullName = new Map(
    altRepoRows.map((r) => [`${r.owner}/${r.name}`, r.id]),
  );

  const compareRows: CompareRow[] = [
    {
      repo: `${repo.owner}/${repo.name}`,
      tradeoff: guide?.verdict ?? null,
      rating,
      stars: repo.stars,
      isCurrent: true,
    },
    ...alternatives.map((alt) => {
      const altId = altIdByFullName.get(alt.repo);
      const inputs = altId ? altRatings.get(altId) : undefined;
      return {
        repo: alt.repo,
        tradeoff: alt.tradeoff,
        rating: inputs ? rateRepo(inputs) : null,
        stars: inputs?.stars ?? null,
        isCurrent: false,
        repoId: altId && stackIdByRepo.has(altId) ? altId : undefined,
      };
    }),
  ].sort((a, b) => (b.rating?.overall ?? -1) - (a.rating?.overall ?? -1));

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="flex flex-wrap items-center gap-2 font-heading text-2xl font-semibold tracking-tight">
            {repo.owner}/{repo.name}
            {rating && <RatingBadge rating={rating} />}
            <a
              href={`https://github.com/${repo.owner}/${repo.name}`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-primary"
              aria-label="Open on GitHub"
            >
              <ExternalLinkIcon className="size-4" />
            </a>
          </h1>

          <p className="max-w-2xl text-sm text-muted-foreground">
            {guide?.whatItIs ?? repo.description ?? "No description yet."}
          </p>

          <div className="flex flex-wrap items-center gap-1">
            {guide?.bestFor.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
            {repo.stars !== null && (
              <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <StarIcon className="size-3" />
                {repo.stars.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GenerateGuideButton repoId={repo.id} hasGuide={Boolean(guide)} />
          <RefreshRepoButton repoId={repo.id} label="Sync" />
          <StackButton
            owner={repo.owner}
            name={repo.name}
            repoId={stackIdByRepo.has(repo.id) ? repo.id : undefined}
          />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={GaugeIcon}
          label="Rating"
          value={
            rating ? `${rating.grade} · ${rating.overall.toFixed(1)}` : "—"
          }
          hint={guide ? "measured + README" : "measured only"}
        />
        <StatTile
          icon={TagIcon}
          label="Releases"
          value={totalRows[0]?.total ?? 0}
          delay={60}
        />
        <StatTile
          icon={ShieldAlertIcon}
          tone={breaking30d > 0 ? "danger" : "default"}
          delay={120}
          label={`Breaking ${WINDOW_DAYS}d`}
          value={breaking30d}
          hint={`${windowRows[0]?.total ?? 0} releases ${WINDOW_DAYS}d`}
        />
        <StatTile
          icon={TimerIcon}
          delay={180}
          label="Synced"
          value={formatRelative(repo.lastIngestedAt)}
          hint={`latest ${formatDate(self?.lastRelease ?? null)}`}
        />
      </div>

      {rating && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            <GaugeIcon className="size-3.5" />
            Score breakdown
          </h2>
          <div className="animate-rise rounded-lg p-3 ring-1 ring-foreground/10">
            <RatingBars rating={rating} />
            {guide?.verdict && (
              <p className="mt-3 text-sm text-muted-foreground">
                {guide.verdict}
              </p>
            )}
          </div>
        </section>
      )}

      {guide ? (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            <BookOpenIcon className="size-3.5" />
            How to use
          </h2>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="lift animate-rise flex flex-col gap-3 rounded-lg p-3 ring-1 ring-foreground/10 hover:ring-primary/40">
              {guide.install && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Install</span>
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">
                    {guide.install}
                  </pre>
                </div>
              )}
              {guide.quickStart && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Quick start
                  </span>
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">
                    {guide.quickStart}
                  </pre>
                </div>
              )}
            </div>

            <div className="lift animate-rise flex flex-col gap-3 rounded-lg p-3 ring-1 ring-foreground/10 hover:ring-primary/40">
              {guide.keyConcepts.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Key concepts
                  </span>
                  <ul className="flex flex-col gap-1">
                    {guide.keyConcepts.map((concept) => (
                      <li key={concept.name} className="text-sm">
                        <span className="font-medium">{concept.name}</span>{" "}
                        <span className="text-muted-foreground">
                          — {concept.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {guide.gotchas.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">Gotchas</span>
                  <ul className="flex list-disc flex-col gap-1 pl-4">
                    {guide.gotchas.map((gotcha) => (
                      <li
                        key={gotcha}
                        className="text-sm text-muted-foreground"
                      >
                        {gotcha}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          No guide yet — hit Explain to rate this repo and find alternatives.
        </p>
      )}

      {compareRows.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            <GitCompareIcon className="size-3.5" />
            Alternatives
          </h2>
          <AlternativesCompare rows={compareRows} />
          <p className="text-xs text-muted-foreground">
            Add an alternative to your stack to score it on the same scale.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          <PackageIcon className="size-3.5" />
          Releases
        </h2>
        {releaseRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing ingested. Hit Sync.
          </p>
        ) : (
          <div className="rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-full">Summary</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Effort</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releaseRows.map((row) => {
                  const parsed = ReleaseSummarySchema.safeParse(row.data);
                  return (
                    <TableRow key={row.releaseId}>
                      <TableCell className="font-mono text-xs">
                        {row.tag}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(row.publishedAt)}
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {parsed.success ? parsed.data.headline : "—"}
                      </TableCell>
                      <TableCell>
                        {parsed.success && (
                          <div className="flex flex-wrap gap-1">
                            {[
                              ...new Set(
                                parsed.data.changes.map((c) => c.type),
                              ),
                            ].map((type) => (
                              <Badge key={type} variant={BADGE_VARIANT[type]}>
                                {type}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {parsed.success ? parsed.data.upgradeEffort : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

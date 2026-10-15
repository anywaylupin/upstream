import { ExternalLinkIcon } from 'lucide-react';
import { SummarizeReleaseButton } from '@/components/summarize-release-button';
import { SummarizeRepoButton } from '@/components/summarize-repo-button';
import { Badge } from '@/components/ui/badge';
import { StageMark, VerdictBadge } from '@/components/verdict-badge';
import { upgradeVerdict } from '@/lib/digest-filters';
import { formatDate } from '@/lib/format';
import { ReleaseSummary as ReleaseSummarySchema } from '@/lib/summarize';

/**
 * The release history as a list, newest first.
 * It was a five-column table whose Changes and Upgrade columns sat empty for every unsummarized release, with the buttons squeezed into Summary.
 * Each row now has one job on the right: the verdict once summarized, a Summarize button until then.
 */
export function ReleasesTable({
  releaseRows,
  repoId,
  owner,
  name,
  followed
}: {
  releaseRows: { releaseId: number; tag: string; publishedAt: Date | null; data: unknown }[];
  repoId: number;
  owner: string;
  name: string;
  /** Summarizing needs the repo in the stack; otherwise rows only link to their notes. */
  followed: boolean;
}) {
  if (releaseRows.length === 0) {
    return <p className="text-muted-foreground text-sm">No releases on GitHub yet.</p>;
  }

  const rows = releaseRows.map((row) => {
    const parsed = ReleaseSummarySchema.safeParse(row.data);
    return { ...row, summary: parsed.success ? parsed.data : null };
  });
  const pending = rows.filter((row) => !row.summary).length;

  return (
    <section className="flex flex-col gap-3" aria-label="Releases">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Newest {rows.length}, {rows.length - pending} summarized
        </p>
        {followed && pending > 0 && <SummarizeRepoButton repoId={repoId} />}
        {!followed && pending > 0 && <p className="text-muted-foreground text-sm">Follow this repo to summarize</p>}
      </div>

      <ul className="divide-y divide-border rounded-lg border bg-card">
        {rows.map((row) => {
          const notes = `https://github.com/${owner}/${name}/releases/tag/${encodeURIComponent(row.tag)}`;
          const verdict = row.summary ? upgradeVerdict(row.summary) : null;
          const types = row.summary ? [...new Set(row.summary.changes.map((c) => c.type))] : [];
          return (
            <li
              key={row.releaseId}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
            >
              <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-0.5">
                <span className="flex items-center gap-1.5 font-medium text-sm">
                  <StageMark verdict={verdict ?? 'pending'} />
                  {row.tag}
                </span>
                <span className="text-muted-foreground text-xs">{formatDate(row.publishedAt)}</span>
              </div>

              <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-auto">
                {row.summary ? (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm">{row.summary.headline}</p>
                    <div className="flex flex-wrap gap-1">
                      {types.map((type) => (
                        <Badge key={type} variant="outline" className="font-normal text-muted-foreground">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Not summarized</p>
                )}
              </div>

              <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 sm:col-start-auto sm:row-start-auto">
                {verdict ? (
                  <>
                    <VerdictBadge verdict={verdict} />
                    <a
                      href={notes}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Release notes for ${row.tag} on GitHub`}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                    >
                      <ExternalLinkIcon className="size-4" />
                    </a>
                  </>
                ) : followed ? (
                  <SummarizeReleaseButton releaseId={row.releaseId} owner={owner} name={name} tag={row.tag} />
                ) : (
                  <a
                    href={notes}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Read on GitHub
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

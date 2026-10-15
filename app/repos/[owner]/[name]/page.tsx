import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AlternativesCompare } from '@/components/alternatives-compare';
import { FactGrid } from '@/components/fact-grid';
import { OwnerAvatar } from '@/components/owner-avatar';
import { RepoOverview } from '@/components/repo/overview';
import { ReleasesTable } from '@/components/repo/releases-table';
import { RepoActions } from '@/components/repo-actions';
import { Badge } from '@/components/ui/badge';
import { UrlTabs } from '@/components/url-tabs';
import { formatRelative } from '@/lib/format';
import { getRepoReport } from '@/lib/repo-report';
import { requireUser } from '@/lib/session';

/** The one-line verdict is the most useful sentence on the page, so it leads. */
export default async function RepoReport({
  params,
  searchParams
}: {
  params: Promise<{ owner: string; name: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { owner, name } = await params;
  const requestedTab = (await searchParams).tab;
  const initialTab = requestedTab === 'releases' || requestedTab === 'alternatives' ? requestedTab : 'overview';

  const report = await getRepoReport(user.id, owner, name);
  if (!report) notFound();
  const { repo, guide, rating, self, releaseRows, totalRows, windowRows, breaking30d, compareRows, stackIdByRepo } =
    report;

  const facts: { label: string; value: ReactNode }[] = [
    { label: 'Stars', value: (repo.stars ?? 0).toLocaleString() },
    { label: 'Releases', value: (totalRows[0]?.total ?? 0).toLocaleString() },
    { label: 'This month', value: windowRows[0]?.total ?? 0 },
    { label: 'Last release', value: self?.lastRelease ? formatRelative(self.lastRelease) : 'never' },
    { label: 'Checked', value: repo.lastIngestedAt ? formatRelative(repo.lastIngestedAt) : 'not yet' }
  ];

  const alternativesPanel =
    compareRows.length > 1 ? (
      <div className="flex flex-col gap-2">
        <AlternativesCompare rows={compareRows} />
        <p className="text-muted-foreground text-sm">Follow one to score it on your weights.</p>
      </div>
    ) : (
      <p className="text-muted-foreground text-sm">
        {guide ? 'The guide named no alternatives that exist on GitHub.' : 'Alternatives come with the AI guide.'}
      </p>
    );

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="flex items-center gap-2.5 font-heading font-semibold text-2xl tracking-tight">
              <OwnerAvatar owner={repo.owner} icon={repo.iconUrl} size={32} />
              <span className="truncate">
                <span className="text-muted-foreground">{repo.owner}/</span>
                {repo.name}
              </span>
            </h1>
            {guide?.verdict && <p className="max-w-2xl text-base">{guide.verdict}</p>}
            <p className="max-w-2xl text-muted-foreground text-sm">
              {guide?.whatItIs ?? repo.description ?? 'No description yet.'}
            </p>
            {(breaking30d > 0 || (guide?.bestFor.length ?? 0) > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {breaking30d > 0 && <Badge variant="destructive">{breaking30d} breaking this month</Badge>}
                {guide?.bestFor.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <RepoActions
            repoId={repo.id}
            owner={repo.owner}
            name={repo.name}
            followed={stackIdByRepo.has(repo.id)}
            hasGuide={Boolean(guide)}
          />
        </div>

        <FactGrid facts={facts} />
      </header>

      <UrlTabs
        param="tab"
        initial={initialTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'releases', label: 'Releases', count: totalRows[0]?.total ?? 0 },
          { id: 'alternatives', label: 'Alternatives', count: Math.max(0, compareRows.length - 1) }
        ]}
        panels={{
          overview: <RepoOverview rating={rating} guide={guide} repo={repo} />,
          releases: (
            <ReleasesTable
              releaseRows={releaseRows}
              owner={repo.owner}
              name={repo.name}
              followed={stackIdByRepo.has(repo.id)}
            />
          ),
          alternatives: alternativesPanel
        }}
      />
    </div>
  );
}

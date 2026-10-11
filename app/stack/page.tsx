import { PageHeader } from '@/components/page-header';
import { StackTable } from '@/components/stack-table';
import { SyncStackButton } from '@/components/sync-stack-button';
import { getRatingWeights, getStackStats } from '@/lib/repo-stats';
import { requireUser } from '@/lib/session';

export default async function StackPage() {
  const user = await requireUser();
  const [{ rows }, weights] = await Promise.all([getStackStats(user.id), getRatingWeights(user.id)]);

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="Following"
        description={`${rows.length} repo${rows.length === 1 ? '' : 's'}, rated by your weights`}
        action={rows.length > 0 && <SyncStackButton />}
      />

      <StackTable
        rows={rows}
        weights={weights}
        showStackToggle
        emptyTitle="Not following anything yet"
        emptyMessage="Paste a repo URL, or pick one from the repos you already own and watch."
      />
    </div>
  );
}

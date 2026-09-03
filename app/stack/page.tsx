import { StackTable } from '@/components/stack-table';
import { SyncStackButton } from '@/components/sync-stack-button';
import { getStackStats } from '@/lib/repo-stats';
import { requireUser } from '@/lib/session';

export default async function StackPage() {
  const user = await requireUser();
  const { rows } = await getStackStats(user.id);

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {rows.length > 0 && <SyncStackButton />}
      </header>

      <StackTable
        rows={rows}
        showStackToggle
        emptyTitle="Your stack is empty"
        emptyMessage="Paste a repo URL, or pick one from the repos you already own and watch."
      />
    </div>
  );
}

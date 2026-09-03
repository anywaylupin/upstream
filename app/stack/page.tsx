import { CompassIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { AddRepoDialog } from '@/components/add-repo-dialog';
import { StackTable } from '@/components/stack-table';
import { SyncStackButton } from '@/components/sync-stack-button';
import { Button } from '@/components/ui/button';
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
        emptyMessage="Paste a repo URL, or pick one from your GitHub account."
        emptyAction={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <AddRepoDialog
              trigger={
                <Button size="sm">
                  <PlusIcon data-icon="inline-start" />
                  Add a repo
                </Button>
              }
            />
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/repositories" />}>
              <CompassIcon data-icon="inline-start" />
              Browse your GitHub
            </Button>
          </div>
        }
      />
    </div>
  );
}

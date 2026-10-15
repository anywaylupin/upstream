import { SlidersHorizontalIcon } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StackTable } from '@/components/stack-table';
import { SyncStackButton } from '@/components/sync-stack-button';
import { Button } from '@/components/ui/button';
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
        action={
          rows.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/settings?section=rating" />}
                nativeButton={false}
              >
                <SlidersHorizontalIcon data-icon="inline-start" />
                Edit rating
              </Button>
              <SyncStackButton />
            </>
          )
        }
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

import type { LucideIcon } from 'lucide-react';
import { CompassIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { AddRepoDialog } from '@/components/add-repo-dialog';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/**
 * The one way out of an empty stack, shared by the dashboard, the digest and
 * the stack table.
 *
 * The wording and the icon change with the page - an empty digest is not the
 * same news as an empty stack - but the actions are deliberately identical
 * everywhere, so there is one thing to learn rather than three.
 */
export function EmptyStackActions() {
  return (
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
  );
}

export function EmptyStack({
  icon: Icon,
  title,
  description
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Empty className="animate-rise rounded-lg ring-1 ring-foreground/10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <EmptyStackActions />
      </EmptyContent>
    </Empty>
  );
}

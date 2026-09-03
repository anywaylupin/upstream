'use client';

import { CheckIcon, PlusIcon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { addToStack, removeFromStack } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function StackButton({
  owner,
  name,
  repoId
}: {
  owner: string;
  name: string;
  /** The repo's id, set only when it is already in the user's stack. */
  repoId?: number;
}) {
  const [pending, startTransition] = useTransition();
  const label = `${owner}/${name}`;

  if (repoId !== undefined) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-busy={pending}
        onClick={(event) => {
          event.stopPropagation();
          startTransition(async () => {
            await removeFromStack(repoId);
            toast.success(`Removed ${label} from your stack`);
          });
        }}
      >
        {pending ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
        {pending ? 'Removing…' : 'In stack'}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        event.stopPropagation();
        // addToStack redirects to the repo page on success, so nothing after
        // the await runs - the toast has to be raised up front.
        toast.success(`Adding ${label}`, {
          description: 'Opening its page while the analysis runs…'
        });
        startTransition(async () => {
          const res = await addToStack(owner, name);
          if (res?.error) toast.error(res.error);
        });
      }}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
      {pending ? 'Adding…' : 'Add'}
    </Button>
  );
}

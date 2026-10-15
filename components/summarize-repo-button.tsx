'use client';

import { SparklesIcon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { summarizeRepo } from '@/app/actions/stack';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** Summarizes this repo's five newest unsummarized releases while the user waits. */
export function SummarizeRepoButton({ repoId }: { repoId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        const id = toast.loading('Summarizing...');
        startTransition(async () => {
          const res = await summarizeRepo(repoId);
          if (res.error) toast.error('Could not summarize', { id, description: res.error });
          else toast.success('Summarized', { id, description: res.message });
        });
      }}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
      Summarize newest 5
    </Button>
  );
}

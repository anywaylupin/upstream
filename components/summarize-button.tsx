'use client';

import { SparklesIcon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { summarizeStack } from '@/app/actions/stack';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** Starts summarizing the pending backlog; the toast carries the reason when the model cannot run. */
export function SummarizeButton({ variant = 'default' }: { variant?: 'default' | 'outline' }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        const id = toast.loading('Summarizing...');
        startTransition(async () => {
          const res = await summarizeStack();
          if (res.error) toast.error('Could not summarize', { id, description: res.error });
          else toast.success('Summarizing', { id, description: res.message });
        });
      }}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
      Summarize now
    </Button>
  );
}

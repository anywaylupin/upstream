'use client';

import { SparklesIcon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { summarizeStack } from '@/app/actions/stack';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Summarizes the five newest unsummarized releases.
 * The tooltip names the model, so it is clear whose quota a click spends; the label stays short because the model name made it wrap.
 * The trigger wraps the button in a span: a `render` element drops its own onClick in base-ui.
 * The toast carries the reason when the model cannot run.
 */
export function SummarizeButton({ variant = 'default', model }: { variant?: 'default' | 'outline'; model?: string }) {
  const [pending, startTransition] = useTransition();

  const button = (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      aria-busy={pending}
      aria-description={model ? `Uses ${model}` : undefined}
      onClick={() => {
        const id = toast.loading('Summarizing...');
        startTransition(async () => {
          const res = await summarizeStack();
          if (res.error) toast.error('Could not summarize', { id, description: res.error });
          else toast.success('Summarized', { id, description: res.message });
        });
      }}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
      Summarize 5
    </Button>
  );

  if (!model) return button;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{button}</TooltipTrigger>
      <TooltipContent>Uses {model}</TooltipContent>
    </Tooltip>
  );
}

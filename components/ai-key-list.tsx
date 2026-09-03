'use client';

import { KeyRoundIcon, Trash2Icon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { removeAiKey } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { providerOf } from '@/lib/ai-models';

export function AiKeyList({ keys }: { keys: { provider: string; hint: string }[] }) {
  const [pending, startTransition] = useTransition();

  if (keys.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No keys yet. Add one from the model picker in the header - Upstream falls back to a shared Google key until
        then.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {keys.map((key) => (
        <li key={key.provider} className="flex items-center justify-between gap-2 py-2 text-sm">
          <span className="flex items-center gap-2">
            <KeyRoundIcon className="size-4 text-primary" />
            <span className="font-medium">{providerOf(key.provider)?.label ?? key.provider}</span>
            <span className="font-mono text-muted-foreground text-xs">{key.hint}</span>
          </span>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  aria-busy={pending}
                  aria-label={`Remove ${key.provider} key`}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await removeAiKey(key.provider);
                      if (res.error) toast.error(res.error);
                      else toast.success('Key removed');
                    });
                  }}
                />
              }
            >
              {pending ? <Spinner /> : <Trash2Icon />}
            </TooltipTrigger>
            <TooltipContent>Remove this key</TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

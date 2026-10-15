'use client';

import { ExternalLinkIcon, SparklesIcon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { summarizeOneRelease } from '@/app/actions/stack';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * The two ways out of an unsummarized release: read the original notes on GitHub, or summarize it now.
 * Summaries are manual, so every unsummarized row offers both instead of a "Pending" label that implied work in progress.
 */
export function SummarizeReleaseButton({
  releaseId,
  owner,
  name,
  tag
}: {
  releaseId: number;
  owner: string;
  name: string;
  tag: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Read the release notes on GitHub"
              render={
                // biome-ignore lint/a11y/useAnchorContent: base-ui renders the icon into this anchor, and aria-label names it
                <a
                  href={`https://github.com/${owner}/${name}/releases/tag/${encodeURIComponent(tag)}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              nativeButton={false}
            />
          }
        >
          <ExternalLinkIcon />
        </TooltipTrigger>
        <TooltipContent>Release notes on GitHub</TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="sm"
        className="text-foreground"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          startTransition(async () => {
            const res = await summarizeOneRelease(releaseId);
            if (res.error) toast.error('Could not summarize', { description: res.error });
            else toast.success(res.message ?? 'Summarized');
          });
        }}
      >
        {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
        {pending ? 'Summarizing...' : 'Summarize'}
      </Button>
    </span>
  );
}

'use client';

import { EllipsisIcon, ExternalLinkIcon, MinusCircleIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { buildRepoGuide, refreshRepo, removeFromStack } from '@/app/actions/stack';
import { StackButton } from '@/components/stack-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';

/**
 * One visible action - follow - and the rest in a menu.
 * "Check for releases" and "Refresh guide" both looked like refresh buttons side by side, though one asks GitHub for releases and the other re-reads the README with AI.
 *
 * `inList` is the Following page, where every row is followed: a "Following" button on each row said nothing, so Unfollow moves into the menu.
 */
export function RepoActions({
  repoId,
  owner,
  name,
  followed,
  hasGuide,
  inList = false
}: {
  repoId: number;
  owner: string;
  name: string;
  followed: boolean;
  hasGuide: boolean;
  inList?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function checkReleases() {
    startTransition(async () => {
      const res = await refreshRepo(repoId);
      if (res.error) toast.error(res.error);
      else toast.success('Releases checked', { description: res.message });
    });
  }

  function refreshGuide() {
    const id = toast.loading('Reading the README...');
    startTransition(async () => {
      const res = await buildRepoGuide(repoId);
      if (res.error) toast.error('Could not build the guide', { id, description: res.error });
      else toast.success('Guide ready', { id, description: res.message });
    });
  }

  function unfollow() {
    startTransition(async () => {
      await removeFromStack(repoId);
      toast.success(`Unfollowed ${owner}/${name}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {!inList && <StackButton owner={owner} name={name} repoId={followed ? repoId : undefined} />}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" aria-label="More actions" aria-busy={pending} />}
        >
          {pending ? <Spinner /> : <EllipsisIcon />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={checkReleases} disabled={pending}>
              <RefreshCwIcon />
              Check for new releases
            </DropdownMenuItem>
            <DropdownMenuItem onClick={refreshGuide} disabled={pending}>
              <SparklesIcon />
              {hasGuide ? 'Refresh AI guide' : 'Explain this repo'}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                // biome-ignore lint/a11y/useAnchorContent: base-ui renders the item's label into this anchor
                <a href={`https://github.com/${owner}/${name}`} target="_blank" rel="noreferrer" />
              }
            >
              <ExternalLinkIcon />
              Open on GitHub
            </DropdownMenuItem>
            {inList && followed && (
              <DropdownMenuItem variant="destructive" onClick={unfollow} disabled={pending}>
                <MinusCircleIcon />
                Unfollow
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

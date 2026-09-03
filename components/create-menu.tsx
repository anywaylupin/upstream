'use client';

import { ChevronDownIcon, CompassIcon, DownloadIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useId, useState } from 'react';
import { type AddRepoState, addRepoByUrl } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

const initialState: AddRepoState = {};

/**
 * The header "+" menu. Owns the add-repo dialog so there is exactly one place
 * in the app that starts this action.
 */
export function CreateMenu() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addRepoByUrl, initialState);
  const inputId = useId();

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />} aria-label="Add">
          <PlusIcon />
          <ChevronDownIcon className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        {/* Auto width with nowrap items: a fixed width wrapped the longest label. */}
        <DropdownMenuContent
          align="end"
          className="w-auto min-w-52 [&_[data-slot=dropdown-menu-item]]:whitespace-nowrap"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Add to stack</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setOpen(true)}>
              <PlusIcon />
              Repo by URL
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/repositories?source=search" />}>
              <CompassIcon />
              Search GitHub
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/repositories?source=owned" />}>
              <DownloadIcon />
              Browse your GitHub repos
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a repo</DialogTitle>
            <DialogDescription>
              Paste a GitHub URL. Releases are pulled now, summaries follow in the background.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="flex flex-col gap-2">
            <Label htmlFor={inputId}>Repo URL</Label>
            <Input
              id={inputId}
              name="url"
              placeholder="https://github.com/owner/name"
              required
              disabled={pending}
              aria-busy={pending}
            />

            {pending && (
              <p className="flex items-center gap-2 text-muted-foreground text-sm">
                <Spinner className="size-3.5" />
                Fetching releases from GitHub…
              </p>
            )}

            {state.error && !pending && <p className="text-destructive text-sm">{state.error}</p>}

            <DialogFooter className="mt-2">
              <Button type="submit" disabled={pending} aria-busy={pending}>
                {pending && <Spinner />}
                {pending ? 'Adding…' : 'Add to stack'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { type ReactElement, useActionState, useEffect, useId, useState } from 'react';
import { type AddRepoState, addRepoByUrl } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

const initialState: AddRepoState = {};

/**
 * The add-repo dialog, so there is exactly one place in the app that starts
 * this action. It is reached from the header's create menu and from an empty
 * stack, which is where someone is most likely to want it.
 *
 * With a `trigger` it opens itself; without one the caller drives `open`, which
 * is what the create menu needs because its own menu item closes the menu first.
 */
export function AddRepoDialog({
  trigger,
  open,
  onOpenChange
}: {
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const [state, formAction, pending] = useActionState(addRepoByUrl, initialState);
  const inputId = useId();

  const isOpen = open ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success, setOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
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
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="https://github.com/owner/name"
            required
            disabled={pending}
            aria-busy={pending}
          />

          {pending && (
            <p className="flex items-center gap-2 text-muted-foreground text-sm">
              <Spinner className="size-3.5" />
              Fetching releases from GitHub...
            </p>
          )}

          {state.error && !pending && <p className="text-destructive text-sm">{state.error}</p>}

          <DialogFooter className="mt-2">
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending && <Spinner />}
              {pending ? 'Adding' : 'Add to stack'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

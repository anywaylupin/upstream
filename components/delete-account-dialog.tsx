'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteAccount } from '@/app/actions';
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

const CONFIRM = 'delete';

export function DeleteAccountDialog({
  preview
}: {
  preview: {
    stack: number;
    repos: number;
    releases: number;
    instructions: number;
  };
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();

  // Spelled out rather than summarised: this is not reversible.
  const erased = [
    'Your GitHub connection and stored tokens',
    'Every AI key you added',
    `${preview.instructions} saved instruction${preview.instructions === 1 ? '' : 's'}`,
    'Digest email, schedule and model choice',
    `${preview.stack} repo${preview.stack === 1 ? '' : 's'} in your stack`,
    'Summaries and guides generated from your instructions',
    preview.repos > 0
      ? `${preview.releases} stored releases for ${preview.repos} repo${preview.repos === 1 ? '' : 's'} nobody else tracks`
      : null
  ].filter((line): line is string => line !== null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <TriangleAlertIcon data-icon="inline-start" />
        Delete account
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your Upstream account</DialogTitle>
          <DialogDescription>This erases everything tied to your account. It cannot be undone.</DialogDescription>
        </DialogHeader>

        <ul className="flex list-disc flex-col gap-1 rounded-lg p-3 pl-7 text-muted-foreground text-sm ring-1 ring-destructive/30">
          {erased.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <p className="text-muted-foreground text-xs">
          Repos other people track stay, along with their shared release data. Upstream keeps its authorisation on your
          GitHub account until you revoke it in GitHub settings.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-semibold">{CONFIRM}</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="destructive"
            disabled={typed !== CONFIRM || pending}
            aria-busy={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await deleteAccount();
                if (res?.error) toast.error(res.error);
              });
            }}
          >
            {pending && <Spinner />}
            {pending ? 'Erasing…' : 'Erase everything'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

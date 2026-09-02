"use client";

import { CheckIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { addToStack, removeFromStack } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function StackButton({
  owner,
  name,
  repoId,
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
        onClick={(event) => {
          event.stopPropagation();
          startTransition(async () => {
            await removeFromStack(repoId);
            toast.success(`Removed ${label} from your stack`);
          });
        }}
      >
        {pending ? (
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
        ) : (
          <CheckIcon data-icon="inline-start" />
        )}
        {pending ? "Removing…" : "In stack"}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        startTransition(async () => {
          const res = await addToStack(owner, name);
          if (res.error) toast.error(res.error);
          else
            toast.success(`Added ${label}`, {
              description: "Pulling releases…",
            });
        });
      }}
    >
      {pending ? (
        <Loader2Icon className="animate-spin" data-icon="inline-start" />
      ) : (
        <PlusIcon data-icon="inline-start" />
      )}
      {pending ? "Adding…" : "Add"}
    </Button>
  );
}

"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "tailwind-variants";
import { syncStack } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function SyncStackButton() {
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          const id = toast.loading("Syncing your stack…");
          startTransition(async () => {
            const res = await syncStack();
            if (res.error) toast.error(res.error, { id });
            else
              toast.success("Stack synced", { id, description: res.message });
          });
        }}
      >
        <RefreshCwIcon
          data-icon="inline-start"
          className={cn(pending && "animate-spin")}
        />
        {pending ? "Syncing…" : "Sync all"}
      </Button>
    </span>
  );
}

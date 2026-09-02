"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "tailwind-variants";
import { refreshRepo } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function RefreshRepoButton({
  repoId,
  label,
}: {
  repoId: number;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex items-center gap-2">
      <Button
        variant="outline"
        size={label ? "sm" : "icon-sm"}
        disabled={pending}
        aria-label={
          `Check ${label ? "" : "for new releases"}`.trim() || undefined
        }
        onClick={(event) => {
          event.stopPropagation();
          startTransition(async () => {
            const res = await refreshRepo(repoId);
            if (res.error) toast.error(res.error);
            else toast.success("Synced", { description: res.message });
          });
        }}
      >
        <RefreshCwIcon className={cn(pending && "animate-spin")} />
        {label}
      </Button>
    </span>
  );
}

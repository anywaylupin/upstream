"use client";

import { SparklesIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { buildRepoGuide } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function GenerateGuideButton({
  repoId,
  hasGuide,
}: {
  repoId: number;
  hasGuide: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex items-center gap-2">
      <Button
        variant={hasGuide ? "outline" : "default"}
        size="sm"
        disabled={pending}
        onClick={() => {
          const id = toast.loading("Reading the README…");
          startTransition(async () => {
            const res = await buildRepoGuide(repoId);
            if (res.error)
              toast.error("Could not build the guide", {
                id,
                description: res.error,
              });
            else toast.success("Guide ready", { id, description: res.message });
          });
        }}
      >
        <SparklesIcon data-icon="inline-start" />
        {pending
          ? "Reading the README…"
          : hasGuide
            ? "Regenerate"
            : "Explain this repo"}
      </Button>
    </span>
  );
}

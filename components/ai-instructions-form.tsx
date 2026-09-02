"use client";

import { useActionState, useId } from "react";
import { type SaveInstructionsState, saveAiInstructions } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: SaveInstructionsState = {};

export function AiInstructionsForm({ defaultValue }: { defaultValue: string }) {
  const [state, formAction, pending] = useActionState(
    saveAiInstructions,
    initialState,
  );
  const textareaId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Label htmlFor={textareaId}>AI instructions</Label>
      <Textarea
        id={textareaId}
        name="instructions"
        rows={4}
        placeholder="e.g. I care most about breaking changes and performance work in React and Next.js."
        defaultValue={defaultValue}
        disabled={pending}
      />
      <p className="text-xs text-muted-foreground">
        Used to highlight and surface releases relevant to you in your digest.
        Doesn't change how releases are summarized.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.success && (
          <span className="text-xs text-muted-foreground">Saved</span>
        )}
        {state.error && (
          <span className="text-xs text-destructive">{state.error}</span>
        )}
      </div>
    </form>
  );
}

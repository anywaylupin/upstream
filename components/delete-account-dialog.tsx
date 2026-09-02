"use client";

import { Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAccount } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRM = "delete";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <TriangleAlertIcon data-icon="inline-start" />
        Delete account
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your Upstream account</DialogTitle>
          <DialogDescription>
            Removes your stack, preferences and GitHub link. Release data and
            summaries are shared with other users and stay. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono font-semibold">{CONFIRM}</span> to
            confirm
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
            onClick={() => {
              startTransition(async () => {
                const res = await deleteAccount();
                if (res?.error) toast.error(res.error);
              });
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAdminAction } from "./useAdminAction";
import type { AdminAction } from "./adminActions";
import type { AdminRow } from "./adminTypes";
import { WhatNextNote, DialogError } from "./WhatNextNote";
import { GENERIC_ERROR } from "./messages";

// The confirm-and-act dialog shared by Deactivate and Reactivate (TP1-10). A title question, a short body, the
// "what happens next" note, and a single primary action that calls the edge function on the target. The
// last-manager guard (deactivate) comes back as the `last_manager` code, which opens the blocked dialog
// instead of showing an inline error. Built on the Dialog primitive, so Radix traps focus and returns it to
// the trigger on close (universal-accessibility-wcag).

export interface ConfirmActionDialogProps {
  admin: AdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: Extract<AdminAction, "deactivate" | "reactivate" | "revoke">;
  title: string;
  body: string;
  whatNext: string;
  submitLabel: string;
  pendingLabel: string;
  destructive?: boolean;
  successMessage: string;
  onDone: (toast: string) => void;
  onBlockedLastManager?: () => void;
}

export function ConfirmActionDialog({
  admin,
  open,
  onOpenChange,
  action,
  title,
  body,
  whatNext,
  submitLabel,
  pendingLabel,
  destructive = false,
  successMessage,
  onDone,
  onBlockedLastManager,
}: ConfirmActionDialogProps) {
  const { run, pending } = useAdminAction();
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setError(null);
    const result = await run(action, { admin_id: admin.id });
    if (result.ok) {
      onDone(successMessage);
      return;
    }
    if (result.code === "last_manager" && onBlockedLastManager) {
      onBlockedLastManager();
      return;
    }
    if (result.code === "cannot_target_self") {
      setError("You can't do this to your own account.");
      return;
    }
    setError(result.message || GENERIC_ERROR);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <WhatNextNote>{whatNext}</WhatNextNote>
        {error ? <DialogError>{error}</DialogError> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={submit}
            disabled={pending}
          >
            {pending ? pendingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

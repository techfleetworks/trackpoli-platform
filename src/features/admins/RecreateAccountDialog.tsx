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
import { FormField } from "@/components/ui/form-field";
import { useAdminAction } from "./useAdminAction";
import type { AdminRow } from "./adminTypes";
import { WhatNextNote, DialogError } from "./WhatNextNote";
import { RECREATE, GENERIC_ERROR } from "./messages";

// Recreate the account of an administrator who lost their authenticator (TP1-10, E2E-17, Q-1-06). This deletes
// and re-invites, so it is a destructive, type-the-email-to-confirm action (the primary stays disabled until
// the typed email matches). The server refuses self and the last manager; `last_manager` opens the blocked
// dialog.
export function RecreateAccountDialog({
  admin,
  open,
  onOpenChange,
  onDone,
  onBlockedLastManager,
}: {
  admin: AdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (toast: string) => void;
  onBlockedLastManager: () => void;
}) {
  const { run, pending } = useAdminAction();
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const matches = confirmEmail.trim().toLowerCase() === admin.email.toLowerCase();
  const mismatch = confirmEmail.trim() !== "" && !matches;

  async function submit() {
    if (!matches) return;
    setError(null);
    const result = await run("recreate", { admin_id: admin.id });
    if (result.ok) {
      onDone(RECREATE.success(admin.displayName));
      return;
    }
    if (result.code === "last_manager") {
      onBlockedLastManager();
      return;
    }
    if (result.code === "cannot_target_self") {
      setError("You can't recreate your own account.");
      return;
    }
    setError(result.message || GENERIC_ERROR);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{RECREATE.title(admin.displayName)}</DialogTitle>
          <DialogDescription>{RECREATE.body(admin.displayName)}</DialogDescription>
        </DialogHeader>
        <WhatNextNote>{RECREATE.whatNext}</WhatNextNote>
        <FormField
          label={RECREATE.confirmLabel}
          type="email"
          autoComplete="off"
          placeholder={RECREATE.confirmPlaceholder}
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          error={mismatch ? RECREATE.confirmMismatch : undefined}
        />
        {error ? <DialogError>{error}</DialogError> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={submit} disabled={pending || !matches}>
            {pending ? RECREATE.pending : RECREATE.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

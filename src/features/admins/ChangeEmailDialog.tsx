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
import { CHANGE_EMAIL, GENERIC_ERROR } from "./messages";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Change the email an administrator signs in with (TP1-10, Q-1-10/Q-1-24). Client-side guards catch the
// obvious cases (invalid format, unchanged) before the call; the server is authoritative for a duplicate
// (`email_in_use`). On success the person's sessions end and any Google link is removed (handled server-side);
// the toast copy does NOT claim a notification was sent, since that notice is parked for TP1-12 (ADR-0021).
export function ChangeEmailDialog({
  admin,
  open,
  onOpenChange,
  onDone,
}: {
  admin: AdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (toast: string) => void;
}) {
  const { run, pending } = useAdminAction();
  const [newEmail, setNewEmail] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  async function submit() {
    setFieldError(null);
    setFormError(null);
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setFieldError(CHANGE_EMAIL.invalidEmail);
      return;
    }
    if (email === admin.email.toLowerCase()) {
      setFieldError(CHANGE_EMAIL.sameEmail);
      return;
    }
    const result = await run("change-email", { admin_id: admin.id, new_email: email });
    if (result.ok) {
      onDone(CHANGE_EMAIL.success(admin.displayName));
      return;
    }
    if (result.code === "email_in_use") {
      setFieldError(CHANGE_EMAIL.inUse);
      return;
    }
    if (result.code === "conflict") {
      setFieldError(CHANGE_EMAIL.sameEmail);
      return;
    }
    if (result.code === "validation_failed") {
      setFieldError(CHANGE_EMAIL.invalidEmail);
      return;
    }
    setFormError(result.message || GENERIC_ERROR);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{CHANGE_EMAIL.title(admin.displayName)}</DialogTitle>
          <DialogDescription>{CHANGE_EMAIL.body(admin.displayName)}</DialogDescription>
        </DialogHeader>
        <FormField
          label={CHANGE_EMAIL.currentLabel}
          type="email"
          value={admin.email}
          readOnly
          disabled
          autoComplete="off"
        />
        <FormField
          label={CHANGE_EMAIL.newLabel}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={CHANGE_EMAIL.newPlaceholder}
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          error={fieldError ?? undefined}
        />
        <WhatNextNote>{CHANGE_EMAIL.whatNext}</WhatNextNote>
        {formError ? <DialogError>{formError}</DialogError> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={pending || newEmail.trim() === ""}>
            {pending ? CHANGE_EMAIL.pending : CHANGE_EMAIL.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

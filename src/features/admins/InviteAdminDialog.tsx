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
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { AdminRole } from "@/lib/roles";
import { useAdminAction } from "./useAdminAction";
import { WhatNextNote, DialogError } from "./WhatNextNote";
import { INVITE, ROLE_OPTIONS, GENERIC_ERROR } from "./messages";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Invite a new administrator (TP1-10, drives the existing TP1-09 invite-admin function). A manager enters the
// email, name and role; the person is emailed a link and stays Invited until they finish onboarding. A
// duplicate email comes back `email_in_use` on the email field.
export function InviteAdminDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (toast: string) => void;
}) {
  const { run, pending } = useAdminAction();
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<AdminRole>("admin");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const roleId = React.useId();

  async function submit() {
    setEmailError(null);
    setNameError(null);
    setFormError(null);
    const e = email.trim().toLowerCase();
    const n = name.trim();
    if (!EMAIL_RE.test(e)) {
      setEmailError(INVITE.invalidEmail);
      return;
    }
    if (n === "") {
      setNameError("Enter the person's name.");
      return;
    }
    const result = await run("invite", { email: e, display_name: n, role });
    if (result.ok) {
      onDone(INVITE.success(e));
      return;
    }
    if (result.code === "email_in_use") {
      setEmailError("An administrator already uses that email.");
      return;
    }
    if (result.code === "validation_failed") {
      setEmailError(INVITE.invalidEmail);
      return;
    }
    setFormError(result.message || GENERIC_ERROR);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{INVITE.title}</DialogTitle>
          <DialogDescription>{INVITE.body}</DialogDescription>
        </DialogHeader>
        <FormField
          label={INVITE.emailLabel}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={INVITE.emailPlaceholder}
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          error={emailError ?? undefined}
        />
        <FormField
          label={INVITE.nameLabel}
          type="text"
          autoComplete="off"
          placeholder={INVITE.namePlaceholder}
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          error={nameError ?? undefined}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={roleId}>{INVITE.roleLabel}</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
            <SelectTrigger id={roleId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <WhatNextNote>{INVITE.whatNext}</WhatNextNote>
        {formError ? <DialogError>{formError}</DialogError> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? INVITE.pending : INVITE.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

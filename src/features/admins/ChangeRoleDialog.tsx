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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { roleLabel, type AdminRole } from "@/lib/roles";
import { useAdminAction } from "./useAdminAction";
import type { AdminRow } from "./adminTypes";
import { WhatNextNote, DialogError } from "./WhatNextNote";
import { CHANGE_ROLE, ROLE_OPTIONS, GENERIC_ERROR } from "./messages";

// Change an administrator's role (TP1-10). The database guard refuses to demote the last active manager; that
// `last_manager` code opens the blocked dialog instead of an inline error. The submit stays disabled while the
// selection equals the current role, so a no-op change-role is never sent.
export function ChangeRoleDialog({
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
  const [role, setRole] = React.useState<AdminRole>(admin.role);
  const [error, setError] = React.useState<string | null>(null);
  const selectId = React.useId();

  async function submit() {
    setError(null);
    const result = await run("change-role", { admin_id: admin.id, role });
    if (result.ok) {
      onDone(CHANGE_ROLE.success(admin.displayName, roleLabel(role)));
      return;
    }
    if (result.code === "last_manager") {
      onBlockedLastManager();
      return;
    }
    if (result.code === "conflict") {
      setError(`${admin.displayName} already has that role.`);
      return;
    }
    setError(result.message || GENERIC_ERROR);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{CHANGE_ROLE.title(admin.displayName)}</DialogTitle>
          <DialogDescription>{admin.email}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={selectId}>{CHANGE_ROLE.roleLabel}</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
            <SelectTrigger id={selectId}>
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
        <WhatNextNote>{CHANGE_ROLE.whatNext}</WhatNextNote>
        {error ? <DialogError>{error}</DialogError> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={pending || role === admin.role}>
            {pending ? CHANGE_ROLE.pending : CHANGE_ROLE.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

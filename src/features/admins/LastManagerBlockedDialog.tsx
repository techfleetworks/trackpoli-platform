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
import { LAST_MANAGER } from "./messages";

// Shown when a demote, deactivate or recreate comes back `last_manager` — the database guard (migration 002)
// refused to remove the final active Administrator Manager (TP1-10, E2E-10). Explains why and what to do
// instead; it is informational, so its only action is dismiss.
export function LastManagerBlockedDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{LAST_MANAGER.title}</DialogTitle>
          <DialogDescription>{LAST_MANAGER.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">{LAST_MANAGER.dismiss}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

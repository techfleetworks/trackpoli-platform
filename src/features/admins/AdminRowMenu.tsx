"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { AdminRow } from "./adminTypes";
import { ROW_MENU } from "./messages";

// The per-row "⋯ More actions" menu (TP1-10). The available actions depend on the administrator's status:
// an active admin can be re-roled, have their email changed, be recreated (lost authenticator) or
// deactivated; an invited one can be re-roled, re-emailed, resent or revoked; a deactivated one can be
// reactivated or re-emailed. The destructive actions use the destructive menu-item styling. The parent owns
// the dialogs; these items only signal which one to open.
export interface AdminRowActions {
  onChangeRole: (admin: AdminRow) => void;
  onChangeEmail: (admin: AdminRow) => void;
  onRecreate: (admin: AdminRow) => void;
  onDeactivate: (admin: AdminRow) => void;
  onReactivate: (admin: AdminRow) => void;
  onResend: (admin: AdminRow) => void;
  onRevoke: (admin: AdminRow) => void;
}

export function AdminRowMenu({ admin, actions }: { admin: AdminRow; actions: AdminRowActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={ROW_MENU.label(admin.displayName)}>
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {admin.status === "active" && (
          <>
            <DropdownMenuItem onSelect={() => actions.onChangeRole(admin)}>{ROW_MENU.changeRole}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onChangeEmail(admin)}>{ROW_MENU.changeEmail}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onRecreate(admin)}>{ROW_MENU.recreate}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onDeactivate(admin)}>
              {ROW_MENU.deactivate}
            </DropdownMenuItem>
          </>
        )}
        {admin.status === "invited" && (
          <>
            <DropdownMenuItem onSelect={() => actions.onChangeRole(admin)}>{ROW_MENU.changeRole}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onChangeEmail(admin)}>{ROW_MENU.changeEmail}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onResend(admin)}>{ROW_MENU.resend}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onRevoke(admin)}>
              {ROW_MENU.revoke}
            </DropdownMenuItem>
          </>
        )}
        {admin.status === "deactivated" && (
          <>
            <DropdownMenuItem onSelect={() => actions.onReactivate(admin)}>{ROW_MENU.reactivate}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.onChangeEmail(admin)}>{ROW_MENU.changeEmail}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

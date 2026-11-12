"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { useSnackbar } from "@/components/ui/snackbar";
import { cn } from "@/lib/utils";
import type { AdminStatus } from "@/lib/roles";

import type { AdminRow } from "./adminTypes";
import { useAdmins } from "./useAdmins";
import { useAdminAction } from "./useAdminAction";
import { AdminTable } from "./AdminTable";
import type { AdminRowActions } from "./AdminRowMenu";
import { InviteAdminDialog } from "./InviteAdminDialog";
import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { ChangeEmailDialog } from "./ChangeEmailDialog";
import { RecreateAccountDialog } from "./RecreateAccountDialog";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { LastManagerBlockedDialog } from "./LastManagerBlockedDialog";
import { ADMIN_LIST, DEACTIVATE, REACTIVATE, ROW_MENU, GENERIC_ERROR } from "./messages";

type StatusFilter = "all" | AdminStatus;

type DialogState =
  | { kind: "none" }
  | { kind: "invite" }
  | { kind: "change-role"; admin: AdminRow }
  | { kind: "change-email"; admin: AdminRow }
  | { kind: "recreate"; admin: AdminRow }
  | { kind: "deactivate"; admin: AdminRow }
  | { kind: "reactivate"; admin: AdminRow }
  | { kind: "revoke"; admin: AdminRow }
  | { kind: "last-manager" };

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: ADMIN_LIST.tabs.all },
  { value: "active", label: ADMIN_LIST.tabs.active },
  { value: "invited", label: ADMIN_LIST.tabs.invited },
  { value: "deactivated", label: ADMIN_LIST.tabs.deactivated },
];

const titleLarge =
  "text-[length:var(--md-title-large-size)] font-medium leading-[var(--md-title-large-line)] tracking-[var(--md-title-large-tracking)]";
const bodySmall =
  "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

// The Admin-management list (TP1-10, P1-13). Loads the administrators, filters by search + status, and hosts
// the action dialogs. Each action posts to the edge function via the dialog; on success the list refetches
// quietly and a snackbar confirms. The manager-only guard is enforced by the page (and the server service +
// RLS); this component assumes a manager caller.
export function AdminList() {
  const { admins, status, reload } = useAdmins();
  const { show } = useSnackbar();
  const { run: runDirect } = useAdminAction();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<StatusFilter>("all");
  const [dialog, setDialog] = React.useState<DialogState>({ kind: "none" });

  const rows = React.useMemo(() => admins ?? [], [admins]);
  const counts = React.useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      invited: rows.filter((r) => r.status === "invited").length,
      deactivated: rows.filter((r) => r.status === "deactivated").length,
    }),
    [rows],
  );

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (q === "") return true;
    return r.displayName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
  });

  const close = React.useCallback(() => setDialog({ kind: "none" }), []);
  const done = React.useCallback(
    (toast: string) => {
      close();
      void reload({ silent: true });
      show({ message: toast });
    },
    [close, reload, show],
  );
  const blockedLastManager = React.useCallback(() => setDialog({ kind: "last-manager" }), []);

  const resend = React.useCallback(
    async (admin: AdminRow) => {
      const result = await runDirect("resend", { admin_id: admin.id });
      if (result.ok) {
        show({ message: `Invitation resent to ${admin.email}.` });
      } else {
        show({ message: result.message || GENERIC_ERROR, assertive: true });
      }
    },
    [runDirect, show],
  );

  const actions: AdminRowActions = {
    onChangeRole: (admin) => setDialog({ kind: "change-role", admin }),
    onChangeEmail: (admin) => setDialog({ kind: "change-email", admin }),
    onRecreate: (admin) => setDialog({ kind: "recreate", admin }),
    onDeactivate: (admin) => setDialog({ kind: "deactivate", admin }),
    onReactivate: (admin) => setDialog({ kind: "reactivate", admin }),
    onResend: (admin) => void resend(admin),
    onRevoke: (admin) => setDialog({ kind: "revoke", admin }),
  };

  const filtersActive = query.trim() !== "" || filter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={cn(titleLarge, "text-foreground")}>{ADMIN_LIST.title}</h1>
        <Button type="button" onClick={() => setDialog({ kind: "invite" })}>
          {ADMIN_LIST.invite}
        </Button>
      </header>

      <div className="flex flex-col gap-4">
        <Input
          type="search"
          inputMode="search"
          aria-label={ADMIN_LIST.searchLabel}
          placeholder={ADMIN_LIST.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />

        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1 border-b border-border">
          {FILTERS.map((f) => {
            const selected = filter === f.value;
            return (
              <Button
                key={f.value}
                type="button"
                variant="ghost"
                aria-pressed={selected}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "h-auto rounded-none px-4 py-2.5",
                  "border-b-[3px] border-transparent",
                  selected ? "border-foreground text-foreground font-semibold" : "text-muted-foreground",
                )}
              >
                {f.label}
                <span className="ml-1.5 text-muted-foreground">{counts[f.value]}</span>
              </Button>
            );
          })}
        </div>

        {status === "loading" ? (
          <LoadingState label={ADMIN_LIST.loading} />
        ) : status === "error" ? (
          <ErrorState
            title={ADMIN_LIST.error.title}
            body={ADMIN_LIST.error.body}
            action={
              <Button type="button" variant="outline" onClick={() => void reload()}>
                {ADMIN_LIST.error.retry}
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={ADMIN_LIST.empty.title}
            body={ADMIN_LIST.empty.body}
            action={
              filtersActive ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  {ADMIN_LIST.empty.clear}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            <AdminTable admins={filtered} actions={actions} />
            <p className={cn(bodySmall, "text-muted-foreground")} aria-live="polite">
              {ADMIN_LIST.count(filtered.length, rows.length)}
            </p>
          </div>
        )}
      </div>

      {dialog.kind === "invite" && (
        <InviteAdminDialog open onOpenChange={(o) => !o && close()} onDone={done} />
      )}
      {dialog.kind === "change-role" && (
        <ChangeRoleDialog
          admin={dialog.admin}
          open
          onOpenChange={(o) => !o && close()}
          onDone={done}
          onBlockedLastManager={blockedLastManager}
        />
      )}
      {dialog.kind === "change-email" && (
        <ChangeEmailDialog admin={dialog.admin} open onOpenChange={(o) => !o && close()} onDone={done} />
      )}
      {dialog.kind === "recreate" && (
        <RecreateAccountDialog
          admin={dialog.admin}
          open
          onOpenChange={(o) => !o && close()}
          onDone={done}
          onBlockedLastManager={blockedLastManager}
        />
      )}
      {dialog.kind === "deactivate" && (
        <ConfirmActionDialog
          admin={dialog.admin}
          open
          onOpenChange={(o) => !o && close()}
          action="deactivate"
          title={DEACTIVATE.title(dialog.admin.displayName)}
          body={DEACTIVATE.body}
          whatNext={DEACTIVATE.whatNext}
          submitLabel={DEACTIVATE.submit}
          pendingLabel={DEACTIVATE.pending}
          destructive
          successMessage={DEACTIVATE.success(dialog.admin.displayName)}
          onDone={done}
          onBlockedLastManager={blockedLastManager}
        />
      )}
      {dialog.kind === "reactivate" && (
        <ConfirmActionDialog
          admin={dialog.admin}
          open
          onOpenChange={(o) => !o && close()}
          action="reactivate"
          title={REACTIVATE.title(dialog.admin.displayName)}
          body={REACTIVATE.body}
          whatNext={REACTIVATE.whatNext}
          submitLabel={REACTIVATE.submit}
          pendingLabel={REACTIVATE.pending}
          successMessage={REACTIVATE.success(dialog.admin.displayName)}
          onDone={done}
        />
      )}
      {dialog.kind === "revoke" && (
        <ConfirmActionDialog
          admin={dialog.admin}
          open
          onOpenChange={(o) => !o && close()}
          action="revoke"
          title={`Revoke the invitation for ${dialog.admin.displayName}?`}
          body="Their invitation link stops working and the account is removed."
          whatNext="The email becomes free to invite again. This cannot be undone, but you can send a fresh invitation."
          submitLabel={ROW_MENU.revoke}
          pendingLabel="Revoking…"
          destructive
          successMessage={`The invitation for ${dialog.admin.displayName} was revoked.`}
          onDone={done}
        />
      )}
      <LastManagerBlockedDialog open={dialog.kind === "last-manager"} onOpenChange={(o) => !o && close()} />
    </div>
  );
}

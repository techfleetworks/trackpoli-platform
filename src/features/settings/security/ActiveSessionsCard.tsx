"use client";

// The Security-tab "Active sessions" card (TP1-05; placed in the Settings Security tab by TP1-11, P1-14;
// Figma 1396:175539). Scope is the bulk action — "Sign out everywhere else" — which revokes the
// administrator's OTHER sessions and leaves this one signed in (OWASP Session Management's simultaneous-login
// policy). TP1-11 adds the confirmation the P1-14 spec requires: the action opens a ConfirmDialog first (so a
// session revocation is never a single accidental click), and the result is announced through the Snackbar
// rather than an inline banner. The per-device list (enumerate every session with device/location/last-active
// and sign each out individually) is still a follow-up: it needs a Supabase session registry + user-agent
// parsing + IP geolocation that do not exist yet (docs/TODO.md). Presentation + wiring only; the revoke
// decision is server-side (/admin/api/session/sign-out-others). Migrated off its MD3 CSS module onto the
// shadcn SettingsCard + Button + ConfirmDialog primitives (ADR-0011 expand/contract).

import { useState } from "react";

import { SettingsCard } from "@/features/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSnackbar } from "@/components/ui/snackbar";
import { apiFetch } from "@/lib/apiFetch";
import { SESSION_MESSAGES as M } from "@/features/auth/messages";

const bodyMedium =
  "text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)]";
const bodySmall =
  "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

export function ActiveSessionsCard() {
  const { show } = useSnackbar();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOutOthers() {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch("/admin/api/session/sign-out-others", { method: "POST" });
      setConfirmOpen(false);
      show({ message: M.signedOutOthers });
    } catch {
      setConfirmOpen(false);
      show({ message: M.signOutOthersError, assertive: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title={M.activeSessionsTitle} titleId="active-sessions-title">
      <div className="flex flex-col divide-y divide-border">
        <div className="flex items-center justify-between gap-4 pb-3">
          <div className="flex flex-col gap-0.5">
            <span className={`${bodyMedium} text-foreground`}>{M.thisDevice}</span>
            <span className={`${bodySmall} text-muted-foreground`}>active now</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3">
          <div className="flex flex-col gap-0.5">
            <span className={`${bodyMedium} text-foreground`}>{M.signOutEverywhereTitle}</span>
            <span className={`${bodySmall} text-muted-foreground`}>{M.signOutEverywhereBody}</span>
          </div>
          <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)}>
            {M.signOutOthers}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !busy && setConfirmOpen(open)}
        title={M.signOutConfirmTitle}
        body={M.signOutConfirmBody}
        confirmLabel={busy ? M.signOutOthersBusy : M.signOutOthers}
        onConfirm={signOutOthers}
        confirmPending={busy}
      />
    </SettingsCard>
  );
}

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
import { PasswordField } from "@/components/ui/password-field";
import { useSnackbar } from "@/components/ui/snackbar";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import type { TwoFactorStatus } from "./twoFactor";

// The Security-tab change-password card + dialog (TP1-11, P1-14). HIDDEN for a Google-only account (which has
// no password), per the ticket. The dialog takes the current password, a new password (>= 12) and a
// confirmation; it posts to /admin/api/settings/change-password, which re-verifies the current password
// (GoTrue-rate-limited) before setting the new one. The auth.password_changed event comes from the DB trigger.

const COPY = {
  heading: "Password",
  subtitle: "Change the password you use to sign in.",
  button: "Change password",
  dialogTitle: "Change your password",
  dialogBody: "Choose a new password that is at least 12 characters.",
  current: "Current password",
  next: "New password",
  confirm: "Confirm new password",
  whatNext:
    "You stay signed in on this device. Your other devices are not signed out by a password change — use “Sign out everywhere else” for that.",
  submit: "Change password",
  pending: "Changing…",
  wrongCurrent: "That password is incorrect.",
  weakNew: "Use at least 12 characters.",
  mismatch: "The new passwords do not match.",
  generic: "Something went wrong. Please try again.",
  success: "Your password was changed.",
} as const;

type ChangePasswordResponse =
  | { outcome: "done" }
  | { outcome: "wrong_password" }
  | { outcome: "weak_password" }
  | { outcome: "not_available" };

const titleMedium =
  "text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[var(--md-title-medium-tracking)]";
const bodyMedium =
  "text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)]";

function ChangePasswordDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [currentError, setCurrentError] = React.useState<string | null>(null);
  const [nextError, setNextError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit() {
    setCurrentError(null);
    setNextError(null);
    setFormError(null);
    if (next.length < 12) {
      setNextError(COPY.weakNew);
      return;
    }
    if (next !== confirm) {
      setNextError(COPY.mismatch);
      return;
    }
    setPending(true);
    try {
      const res = await apiFetch<ChangePasswordResponse>("/admin/api/settings/change-password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      if (res.outcome === "done") {
        onDone();
        return;
      }
      if (res.outcome === "wrong_password") {
        setCurrentError(COPY.wrongCurrent);
        return;
      }
      if (res.outcome === "weak_password") {
        setNextError(COPY.weakNew);
        return;
      }
      setFormError(COPY.generic);
    } catch {
      // Any transport/HTTP failure (apiFetch throws ApiError on non-2xx) surfaces as the generic message;
      // the specific outcomes above are 200 envelopes, so there is nothing finer to say here.
      setFormError(COPY.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{COPY.dialogTitle}</DialogTitle>
          <DialogDescription>{COPY.dialogBody}</DialogDescription>
        </DialogHeader>
        <PasswordField
          label={COPY.current}
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={currentError ?? undefined}
        />
        <PasswordField
          label={COPY.next}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={nextError ?? undefined}
        />
        <PasswordField
          label={COPY.confirm}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <aside
          className={cn(
            "rounded-[var(--md-shape-field)] bg-muted p-3 text-muted-foreground",
            "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]",
          )}
        >
          <span className="font-medium text-foreground">What happens next</span>
          <p className="mt-1">{COPY.whatNext}</p>
        </aside>
        {formError ? (
          <p
            role="alert"
            className="text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] text-destructive"
          >
            {formError}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || current === "" || next === "" || confirm === ""}
          >
            {pending ? COPY.pending : COPY.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChangePasswordCard({ accountType }: { accountType: TwoFactorStatus["accountType"] }) {
  const { show } = useSnackbar();
  const [open, setOpen] = React.useState(false);

  // Google-only accounts have no password to change (the endpoint also refuses them). Render nothing.
  if (accountType === "google") return null;

  return (
    <section className="flex flex-col gap-3 rounded-[var(--md-shape-card)] border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className={cn(titleMedium, "text-foreground")}>{COPY.heading}</h2>
          <p className={cn(bodyMedium, "text-muted-foreground")}>{COPY.subtitle}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {COPY.button}
        </Button>
      </div>
      {open ? (
        <ChangePasswordDialog
          open
          onOpenChange={(o) => !o && setOpen(false)}
          onDone={() => {
            setOpen(false);
            show({ message: COPY.success });
          }}
        />
      ) : null}
    </section>
  );
}

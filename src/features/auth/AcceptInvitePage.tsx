"use client";

// The accept-invite screen (TP1-09, P1-08; adapted from the sign-in frame Figma 1216:2431, built on shadcn/ui
// in grayscale per ADR-0011/0017). An invited administrator lands here from the invite email → /auth/confirm
// Continue page, which exchanges the single-use token hash for an invited session (ADR-0008 pattern). By the
// time they reach this screen they have already accepted the current terms on the shared /terms screen
// (Q-1-20, TP1-08); here they ACTIVATE the account by setting a password — or continuing with Google using
// the invited address (Q-1-23) — which calls complete-invite (status invited → active), after which forced
// two-factor enrolment follows (NFR-S6). Presentation + wiring only: the session, the activation and the
// Google match are server-side (ADR-0005).
//
// The password policy is LENGTH-ONLY (NFR-S2: "minimum 12 characters, no weakening composition rules"),
// matching ResetPasswordPage. The email is fixed to the invited address (read-only): the invite is for that
// person, and continuing with Google must use the same address, so it is shown but not editable.

import { useId, useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { ACCEPT_INVITE_MESSAGES as t } from "./messages";
import markIcon from "./assets/mark.svg";
import googleIcon from "./assets/google.svg";
import visibilityIcon from "./assets/visibility.svg";
import warningIcon from "./assets/warning.svg";
import checkIcon from "./assets/check.svg";
import dotIcon from "./assets/requirement-dot.svg";

const MIN_LENGTH = 12; // NFR-S2 / Supabase minimum_password_length

// Mirrors the server route's outcome (kept local so this client file never imports the server module). The
// route sets the password (auth.updateUser) and calls complete-invite; a missing/expired invite session is
// "no_session", a sub-policy password is "weak_password".
type AcceptInviteResponse = { outcome: "done" } | { outcome: "no_session" } | { outcome: "weak_password" };

const bodySmall =
  "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

export function AcceptInvitePage({ email }: { email: string }) {
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const confirmHelperId = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const meetsLength = password.length >= MIN_LENGTH;
  const matches = confirm !== "" && password === confirm;
  const mismatch = confirm !== "" && password !== confirm;
  const canSubmit = !submitting && meetsLength && matches;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await apiFetch<AcceptInviteResponse>("/admin/api/accept-invite", {
        method: "POST",
        body: { password },
      });
      switch (result.outcome) {
        case "done":
          // Full-page load so the server re-gates: now active and terms-accepted, the user flows on to forced
          // two-factor enrolment and then the dashboard (the accept-invite flow, section 4).
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload so the activated session is re-read and routed on
          window.location.assign("/admin");
          return;
        case "no_session":
          setNotice(t.linkExpired);
          break;
        default:
          setNotice(t.weakPassword);
      }
    } catch {
      // A transport/infra failure is not necessarily a weak password — show a generic message, not the
      // "choose a 12-character password" copy, which would misdescribe the problem.
      setNotice(t.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--md-surface-container-high)] p-6">
      <form
        onSubmit={onSubmit}
        noValidate
        aria-labelledby="accept-invite-title"
        className="flex w-[480px] max-w-full flex-col gap-[22px] rounded-[var(--md-shape-card)] bg-[var(--md-surface-container-lowest)] p-10 shadow-[var(--md-elevation-card)]"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary">
            <Icon src={markIcon} size={22} />
          </span>
          <span className="text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[var(--md-title-medium-tracking)] text-foreground">
            TrackPoli Admin
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h1
            id="accept-invite-title"
            className="m-0 text-[length:var(--md-headline-medium-size)] font-normal leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)] text-foreground"
          >
            {t.title}
          </h1>
          <p className={`m-0 text-muted-foreground text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)]`}>
            {t.subtext}
          </p>
        </div>

        {notice ? (
          <Alert>
            <Icon src={warningIcon} size={22} />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor={emailId}>{t.emailLabel}</Label>
            <Input
              id={emailId}
              type="email"
              name="email"
              autoComplete="username"
              readOnly
              value={email}
              aria-describedby={undefined}
              className="bg-[var(--md-surface-container-high)] text-muted-foreground"
            />
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor={passwordId}>{t.passwordLabel}</Label>
            <div className="relative">
              <Input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                name="new-password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-14"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                <Icon src={visibilityIcon} size={22} />
              </Button>
            </div>
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor={confirmId}>{t.confirmLabel}</Label>
            <div className="relative">
              <Input
                id={confirmId}
                type={showConfirm ? "text" : "password"}
                name="confirm-password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                aria-invalid={mismatch || undefined}
                aria-describedby={mismatch ? confirmHelperId : undefined}
                className="pr-14"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                aria-label={showConfirm ? "Hide password" : "Show password"}
                aria-pressed={showConfirm}
                onClick={() => setShowConfirm((value) => !value)}
              >
                <Icon src={visibilityIcon} size={22} />
              </Button>
            </div>
            {mismatch ? (
              <p id={confirmHelperId} className={`m-0 text-muted-foreground ${bodySmall}`}>
                {t.passwordsMustMatch}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className={`m-0 font-medium text-foreground ${bodySmall}`}>{t.requirementsTitle}</p>
          <p className="m-0 flex items-center gap-2">
            <Icon src={meetsLength ? checkIcon : dotIcon} size={18} />
            <span className={`${bodySmall} ${meetsLength ? "text-foreground" : "text-muted-foreground"}`}>
              {t.minLength}
            </span>
          </p>
        </div>

        <div className="flex w-full items-center gap-3">
          <span className="h-px flex-1 bg-[var(--md-outline-variant)]" />
          <span className={`text-muted-foreground ${bodySmall}`}>{t.orDivider}</span>
          <span className="h-px flex-1 bg-[var(--md-outline-variant)]" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={submitting}
          onClick={() => {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- navigates to a redirect route handler (not a Next page); must be a full browser navigation
            window.location.assign("/admin/auth/google");
          }}
        >
          <Icon src={googleIcon} size={20} />
          {t.continueWithGoogle}
        </Button>

        <Button variant="secondary" className="w-full" type="submit" disabled={!canSubmit}>
          {submitting ? t.activating : t.activate}
        </Button>

        <p className={`m-0 text-center text-muted-foreground ${bodySmall}`}>{t.footnote(email)}</p>
      </form>
    </main>
  );
}

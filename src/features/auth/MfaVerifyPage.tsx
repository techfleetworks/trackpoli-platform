"use client";

// The sign-in step-up screen (Figma node 1211:2431, "Two-step verification"). Reached when a session is
// aal1 with a verified factor (RequireMfa routes it here, ADR-0009). It collects the 6-digit authenticator
// code and posts to /admin/api/mfa/verify, which challenges and verifies the factor and lifts the session
// to aal2; on success it reloads into the app so the upgraded session cookie is applied. A wrong code never
// reveals whether it was incorrect or expired. Presentation + wiring only — the decision logic is server-side.
//
// Accessibility: the design draws a bare code box; we keep the house TextField with a visible label and an
// autocomplete="one-time-code" / inputmode="numeric" input so it stays WCAG-AA and works with password
// managers (universal-accessibility-wcag).

import { useId, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { MFA_MESSAGES } from "./messages";
import { AuthCard, AuthCardFooter } from "./AuthCard";
import warningIcon from "./assets/warning.svg";

// Mirrors the server's VerifyResult (kept local so this client file never imports the server module).
type VerifyResponse =
  | { outcome: "verified" }
  | { outcome: "invalid_code" }
  | { outcome: "too_many_attempts" }
  | { outcome: "no_factor" };

const CODE_PATTERN = /^\d{6}$/;

export function MfaVerifyPage() {
  const codeId = useId();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState(false);

  const canSubmit = !submitting && CODE_PATTERN.test(code);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setNotice(null);
    setFieldError(false);
    try {
      const result = await apiFetch<VerifyResponse>("/admin/api/mfa/verify", {
        method: "POST",
        body: { code },
      });
      switch (result.outcome) {
        case "verified":
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full-page load so the upgraded aal2 session cookie is applied and the server re-renders
          window.location.assign("/admin");
          return;
        case "no_factor":
          // A routing anomaly (the gate should not send a factorless session here) — send them back to sign in.
          setNotice(MFA_MESSAGES.noFactor);
          break;
        case "too_many_attempts":
          setNotice(MFA_MESSAGES.tooManyAttempts);
          setFieldError(true);
          break;
        default:
          setNotice(MFA_MESSAGES.invalidCode);
          setFieldError(true);
      }
    } catch {
      setNotice(MFA_MESSAGES.genericError);
      setFieldError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard aria-labelledby="verify-title">
      <form className="flex w-full flex-col gap-[22px]" onSubmit={onSubmit} noValidate>
        <div className="flex w-full flex-col gap-2">
          <h1
            id="verify-title"
            className="m-0 font-sans text-[length:var(--md-headline-medium-size)] font-normal leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)] text-foreground"
          >
            Two-step verification
          </h1>
          <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
            {MFA_MESSAGES.verifyIntro}
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
            <Label htmlFor={codeId}>Verification code</Label>
            <Input
              id={codeId}
              name="one-time-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={fieldError || undefined}
            />
          </div>
        </div>

        <Button variant="secondary" className="w-full" type="submit" disabled={!canSubmit}>
          Verify
        </Button>

        <AuthCardFooter>{MFA_MESSAGES.verifyRecoveryHelp}</AuthCardFooter>
      </form>
    </AuthCard>
  );
}

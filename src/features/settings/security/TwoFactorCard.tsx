"use client";

// The Security-tab Two-factor card and device-replacement modal (TP1-04 deliverable, ADR-0009; Figma
// 1296:85823 / 1296:89239). The card shows status and opens a 3-step replacement wizard: confirm it's you
// (re-authenticate — password or Google by account type — plus a code from the CURRENT device) -> add the
// new device (QR / key) -> enter the new device's code, which verifies the new factor and drops the old one
// so exactly one remains. A lost current device is never self-service: the "I don't have my current device"
// path explains the manager-recreate recovery (role-aware). The session alone is never trusted (OWASP MFA).
// Presentation + wiring only; the MFA decisions are server-side (/admin/api/mfa/replace).

import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/apiFetch";
import { report } from "@/lib/report";
import { MFA_REPLACE_MESSAGES as M } from "@/features/auth/messages";
import warningIcon from "@/features/auth/assets/warning.svg";
import googleIcon from "@/features/auth/assets/google.svg";
import checkIcon from "@/features/auth/assets/check.svg";
import copyIcon from "@/features/auth/assets/copy.svg";
import lockIcon from "@/features/auth/assets/lock.svg";
import errorIcon from "@/features/auth/assets/error.svg";

type EnrolStart = { factorId: string; qrCode: string; secret: string; uri: string };
type AuthorizeResponse =
  | { outcome: "authorized"; enrol: EnrolStart }
  | { outcome: "reauth_failed" }
  | { outcome: "invalid_current_code" }
  | { outcome: "too_many_attempts" }
  | { outcome: "no_factor" };
type CompleteResponse =
  | { outcome: "replaced" }
  | { outcome: "invalid_new_code" }
  | { outcome: "too_many_attempts" };

type Step = "intro" | "reauth" | "newDevice" | "newCode" | "lost" | "paused" | "failed" | "success";

const SIX = /^\d{6}$/;

function qrSrc(qr: string): string {
  return qr.startsWith("<svg") ? `data:image/svg+xml;utf8,${encodeURIComponent(qr)}` : qr;
}
function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function TwoFactorCard({
  enrolled,
  accountType,
  isManager,
}: {
  enrolled: boolean;
  accountType: "password" | "google";
  isManager: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const passwordId = useId();
  const currentCodeId = useId();
  const newCodeId = useId();

  // Resume the modal after the Google re-auth round-trip returns (?reauth=ok|mismatch|error) by deriving the
  // initial state from the URL, rather than opening it from an effect.
  const reauthParam = params.get("reauth");
  const [step, setStep] = useState<Step | null>(reauthParam ? "reauth" : null);
  const [password, setPassword] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [enrol, setEnrol] = useState<EnrolStart | null>(null);
  const [googleReauthed, setGoogleReauthed] = useState(reauthParam === "ok");
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState<string | null>(
    reauthParam === "mismatch" ? M.googleMismatch : reauthParam === "error" ? M.googleNotCompleted : null,
  );
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function reset() {
    setPassword("");
    setCurrentCode("");
    setNewCode("");
    setEnrol(null);
    setGoogleReauthed(false);
    setShowKey(false);
    setNotice(null);
    setCodeError(false);
    setCopied(false);
  }
  function open() {
    reset();
    setStep("intro");
  }
  function close() {
    setStep(null);
    reset();
    router.refresh();
  }

  function applyAuthorize(result: AuthorizeResponse) {
    switch (result.outcome) {
      case "authorized":
        setEnrol(result.enrol);
        setNotice(null);
        setCodeError(false);
        setShowKey(false);
        setStep("newDevice");
        return;
      case "invalid_current_code":
        setNotice(M.wrongCurrentCode);
        setCodeError(true);
        return;
      case "too_many_attempts":
        setStep("paused");
        return;
      case "no_factor":
        setStep("failed");
        return;
      default:
        setNotice(M.reauthFailed);
    }
  }

  async function authorize() {
    if (!SIX.test(currentCode) || busy) return;
    if (accountType === "password" && password === "") return;
    if (accountType === "google" && !googleReauthed) return;
    setBusy(true);
    setNotice(null);
    setCodeError(false);
    try {
      const body =
        accountType === "password"
          ? { step: "authorize", method: "password", password, currentCode }
          : { step: "authorize", method: "google", currentCode };
      applyAuthorize(await apiFetch<AuthorizeResponse>("/admin/api/mfa/replace", { method: "POST", body }));
    } catch {
      setStep("failed");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!enrol || !SIX.test(newCode) || busy) return;
    setBusy(true);
    setNotice(null);
    setCodeError(false);
    try {
      const result = await apiFetch<CompleteResponse>("/admin/api/mfa/replace", {
        method: "POST",
        body: { step: "complete", newFactorId: enrol.factorId, newCode },
      });
      if (result.outcome === "replaced") setStep("success");
      else if (result.outcome === "too_many_attempts") setStep("paused");
      else {
        setNotice(M.wrongNewCode);
        setCodeError(true);
      }
    } catch {
      setStep("failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!enrol) return;
    try {
      await navigator.clipboard.writeText(enrol.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      report("debug", "clipboard copy unavailable", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const canAuthorize =
    SIX.test(currentCode) && (accountType === "password" ? password !== "" : googleReauthed);

  return (
    <section
      className="flex max-w-[560px] flex-col gap-3 rounded-[var(--md-shape-card)] border border-border bg-card p-6 font-sans"
      aria-labelledby="twofactor-title"
    >
      <h2
        id="twofactor-title"
        className="m-0 font-sans text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[var(--md-title-medium-tracking)] text-foreground"
      >
        {M.cardTitle}
      </h2>
      <p
        data-enrolled={enrolled}
        className={`m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] ${enrolled ? "text-foreground" : "text-muted-foreground"}`}
      >
        {M.cardStatus}
      </p>
      <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
        {M.cardNote}
      </p>
      <Button
        variant="ghost"
        size="inline"
        type="button"
        className="mt-1 self-start rounded-[var(--md-shape-button)] border border-[color:var(--md-outline)] bg-muted px-6 py-2.5 text-[length:var(--md-label-large-size)] leading-[var(--md-label-large-line)] tracking-[var(--md-label-large-tracking)] text-foreground"
        onClick={open}
      >
        {M.replaceButton}
      </Button>

      {step ? renderDialog() : null}
    </section>
  );

  function renderDialog() {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim p-6"
        role="presentation"
        onClick={close}
      >
        <div
          className="flex max-h-[90vh] w-[480px] max-w-full flex-col gap-4 overflow-y-auto rounded-[var(--md-shape-card)] bg-card p-8 font-sans shadow-[var(--md-elevation-card)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="replace-title"
          onClick={(event) => event.stopPropagation()}
        >
          {renderDialogBody()}
        </div>
      </div>
    );
  }

  function renderStepHeader(n: 1 | 2 | 3, title: string) {
    return (
      <>
        <p className="m-0 font-sans text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)] text-muted-foreground">
          Step {n} of 3
        </p>
        <h3 id="replace-title" className="m-0 font-sans text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[var(--md-title-medium-tracking)] text-foreground">
          {title}
        </h3>
      </>
    );
  }

  function renderDialogBody() {
    if (step === "intro") {
      return (
        <>
          <h3 id="replace-title" className="m-0 font-sans text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[var(--md-title-medium-tracking)] text-foreground">
            {M.introTitle}
          </h3>
          <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">{M.introBody}</p>
          <ol className="m-0 flex w-full list-none flex-col gap-4 rounded-md bg-muted p-4">
            {[M.introStep1, M.introStep2, M.introStep3].map((text, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card font-sans text-[length:var(--md-label-large-size)] font-medium leading-none text-foreground">
                  {i + 1}
                </span>
                <span className="font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
                  {text}
                </span>
              </li>
            ))}
          </ol>
          <div className="flex w-full flex-col gap-1.5 rounded-md bg-muted p-4">
            <span className="font-sans text-[length:var(--md-body-medium-size)] font-medium text-foreground">{M.introReassureTitle}</span>
            <span className="font-sans text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)] text-muted-foreground">{M.introReassure}</span>
          </div>
          <div className="mt-1 flex items-center justify-end gap-2">
            <Button variant="ghost" size="inline" type="button" className="self-start px-3 py-2.5 text-[length:var(--md-label-large-size)] tracking-[var(--md-label-large-tracking)]" onClick={close}>
              {M.cancel}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setStep("reauth")}>
              {M.getStarted}
            </Button>
          </div>
        </>
      );
    }

    if (step === "reauth") {
      return (
        <>
          {renderStepHeader(1, M.step1Title)}
          <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
            {accountType === "password" ? M.step1PasswordIntro : M.step1GoogleIntro}
          </p>
          {notice ? <Alert><Icon src={warningIcon} size={22} /><AlertDescription>{notice}</AlertDescription></Alert> : null}
          {accountType === "password" ? (
            <div className="flex w-full flex-col gap-1.5">
              <Label htmlFor={passwordId}>{M.passwordLabel}</Label>
              <Input
                id={passwordId}
                type="password"
                name="current-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex w-full flex-col gap-1.5">
              <span className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
                {M.googleAccountLabel}
              </span>
              <Button
                variant="ghost"
                size="inline"
                type="button"
                className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-md border border-[color:var(--md-outline)] bg-card text-[length:var(--md-label-large-size)] leading-[var(--md-label-large-line)] tracking-[var(--md-label-large-tracking)] ${googleReauthed ? "text-muted-foreground" : "text-foreground"}`}
                data-done={googleReauthed}
                disabled={googleReauthed}
                onClick={() => {
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full navigation to the OAuth round-trip route
                  window.location.assign("/admin/auth/reauth/google");
                }}
              >
                <Icon src={googleReauthed ? checkIcon : googleIcon} size={20} />
                <span>{googleReauthed ? M.reauthedGoogle : M.reauthGoogle}</span>
              </Button>
            </div>
          )}
          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor={currentCodeId}>{M.currentCodeLabel}</Label>
            <Input
              id={currentCodeId}
              name="current-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={currentCode}
              aria-invalid={codeError || undefined}
              onChange={(e) => setCurrentCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <Button variant="ghost" size="inline" type="button" className="self-start px-3 py-2.5 text-[length:var(--md-label-large-size)] tracking-[var(--md-label-large-tracking)] text-primary" onClick={() => setStep("lost")}>
            {M.lostLink}
          </Button>
          <div className="mt-1 flex items-center justify-end gap-2">
            <Button variant="ghost" size="inline" type="button" className="self-start px-3 py-2.5 text-[length:var(--md-label-large-size)] tracking-[var(--md-label-large-tracking)]" onClick={close}>
              {M.cancel}
            </Button>
            <Button variant="secondary" className="w-full" onClick={authorize} disabled={!canAuthorize || busy}>
              {M.continueButton}
            </Button>
          </div>
        </>
      );
    }

    if (step === "newDevice" && enrol) {
      return (
        <>
          {renderStepHeader(2, M.step2Title)}
          <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">{M.step2Body}</p>
          {showKey ? (
            <div className="flex w-full flex-col gap-3 rounded-md bg-muted p-4">
              <span className="font-sans text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[0.1em] text-foreground break-all">
                {groupKey(enrol.secret)}
              </span>
              <Button
                variant="ghost"
                size="inline"
                type="button"
                className="gap-2 self-start text-[length:var(--md-label-large-size)] tracking-[var(--md-label-large-tracking)] text-primary"
                onClick={copyKey}
              >
                <Icon src={copyIcon} size={18} />
                <span>{copied ? "Copied" : "Copy key"}</span>
              </Button>
            </div>
          ) : (
            <div className="flex w-full justify-center">
              <span className="flex size-[184px] items-center justify-center rounded-lg border border-border p-[17px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic QR from the server; next/image cannot optimize it */}
                <img src={qrSrc(enrol.qrCode)} alt="QR code for your new authenticator device" width={150} height={150} />
              </span>
            </div>
          )}
          <Button variant="ghost" size="inline" type="button" className="self-start px-3 py-2.5 text-[length:var(--md-label-large-size)] tracking-[var(--md-label-large-tracking)] text-primary" onClick={() => setShowKey((v) => !v)}>
            {showKey ? "Scan the QR code instead" : "Can't scan? Enter the key manually"}
          </Button>
          <div className="mt-1 flex items-center justify-end gap-2">
            <Button variant="ghost" size="inline" type="button" className="self-start px-3 py-2.5 text-[length:var(--md-label-large-size)] tracking-[var(--md-label-large-tracking)]" onClick={close}>
              {M.cancel}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setStep("newCode")}>
              {M.continueButton}
            </Button>
          </div>
        </>
      );
    }

    if (step === "newCode" && enrol) {
      return (
        <>
          {renderStepHeader(3, M.step3Title)}
          <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">{M.step3Body}</p>
          {notice ? <Alert><Icon src={warningIcon} size={22} /><AlertDescription>{notice}</AlertDescription></Alert> : null}
          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor={newCodeId}>6-digit code</Label>
            <Input
              id={newCodeId}
              name="new-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={newCode}
              aria-invalid={codeError || undefined}
              onChange={(e) => setNewCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          <div className="mt-1 flex items-center justify-end gap-2">
            <Button variant="ghost" size="inline" type="button" className="self-start px-3 py-2.5 text-[length:var(--md-label-large-size)] tracking-[var(--md-label-large-tracking)]" onClick={() => setStep("newDevice")}>
              {M.back}
            </Button>
            <Button variant="secondary" className="w-full" onClick={complete} disabled={!SIX.test(newCode) || busy}>
              {M.replaceConfirm}
            </Button>
          </div>
        </>
      );
    }

    if (step === "lost") {
      return (
        <>
          <h3 id="replace-title" className="m-0 font-sans text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[var(--md-title-medium-tracking)] text-foreground">
            {M.lostTitle}
          </h3>
          <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">{isManager ? M.lostBodyManager : M.lostBodyAdmin}</p>
          <div className="flex w-full flex-col gap-1.5 rounded-md bg-muted p-4">
            <span className="font-sans text-[length:var(--md-body-medium-size)] font-medium text-foreground">
              {isManager ? M.lostNextManagerTitle : M.lostNextAdminTitle}
            </span>
            <span className="font-sans text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)] text-muted-foreground">{isManager ? M.lostNextManager : M.lostNextAdmin}</span>
          </div>
          <div className="mt-1 flex items-center justify-end gap-2">
            <Button variant="ghost" size="inline" type="button" className="self-start px-3 py-2.5 text-[length:var(--md-label-large-size)] tracking-[var(--md-label-large-tracking)]" onClick={close}>
              {M.close}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setStep("reauth")}>
              {M.back}
            </Button>
          </div>
        </>
      );
    }

    if (step === "paused") {
      return renderOutcome(lockIcon, M.pausedTitle, M.pausedBody);
    }
    if (step === "success") {
      return renderOutcome(checkIcon, M.successTitle, M.successBody);
    }
    // failed
    return renderOutcome(errorIcon, M.failedTitle, M.failedBody);
  }

  function renderOutcome(icon: typeof checkIcon, title: string, body: string) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Icon src={icon} size={30} />
        </span>
        <h3 id="replace-title" className="m-0 font-sans text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[var(--md-title-medium-tracking)] text-foreground">
          {title}
        </h3>
        <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">{body}</p>
        <Button variant="secondary" className="w-full" onClick={close}>
          {M.close}
        </Button>
      </div>
    );
  }
}

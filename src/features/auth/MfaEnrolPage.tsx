"use client";

// Forced first-time two-factor enrolment (Figma node 1293:2729, ADR-0009). This is the aal1 gate a new
// administrator (password or Google) is routed to by RequireMfa before any data route; the RLS aal2 gate
// means nothing is reachable until a factor is verified here. A multi-step wizard: Instructions -> scan the
// QR (or enter the key by hand) -> enter the 6-digit code -> success. begin() asks the server for a new
// factor (POST /api/mfa/enrol step:begin); "Verify and turn on" confirms it (step:confirm), which lifts the
// session to aal2. Sign out is always available so a stuck administrator can leave. Presentation + wiring
// only — the MFA decisions are server-side. The card shell is the shared AuthCard (ADR-0028).

import { useId, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError } from "@/lib/apiFetch";
import { report } from "@/lib/report";
import { MFA_ENROL_MESSAGES as M } from "./messages";
import { AuthCard, AuthCardFooter } from "./AuthCard";
import styles from "./MfaEnrolPage.module.css";
import arrowBackIcon from "./assets/arrow-back.svg";
import copyIcon from "./assets/copy.svg";
import checkIcon from "./assets/check.svg";
import errorIcon from "./assets/error.svg";
import lockIcon from "./assets/lock.svg";
import phoneIcon from "./assets/phone.svg";
import warningIcon from "./assets/warning.svg";
import clockIcon from "./assets/clock-lg.svg";

type EnrolStartResponse = { factorId: string; qrCode: string; secret: string; uri: string };
type EnrolConfirmResponse =
  | { outcome: "enrolled" }
  | { outcome: "invalid_code" }
  | { outcome: "too_many_attempts" };

type Step = "instructions" | "scan" | "manual" | "code" | "success" | "paused" | "failed" | "sessionExpired";

/** Render Supabase's QR (an SVG string or a data/URL) as an <img> src without inlining untrusted markup. */
function qrSrc(qr: string): string {
  if (qr.startsWith("<svg")) return `data:image/svg+xml;utf8,${encodeURIComponent(qr)}`;
  return qr;
}

/** Group the base32 secret into 4-char blocks for legible manual entry. */
function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

function StepProgress({ current }: { current: 1 | 2 }) {
  return (
    <div className={styles.progress}>
      <span className={styles.stepLabel}>Step {current} of 2</span>
      <span className={styles.bar}>
        <span className={styles.seg} data-on />
        <span className={styles.seg} data-on={current === 2 ? "" : undefined} />
      </span>
    </div>
  );
}

export function MfaEnrolPage({ email }: { email: string }) {
  const codeId = useId();
  const [step, setStep] = useState<Step>("instructions");
  const [enrol, setEnrol] = useState<EnrolStartResponse | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function begin() {
    setBusy(true);
    try {
      const start = await apiFetch<EnrolStartResponse>("/admin/api/mfa/enrol", {
        method: "POST",
        body: { step: "begin" },
      });
      setEnrol(start);
      setCode("");
      setCodeError(null);
      setStep("scan");
    } catch (error) {
      handleSetupError(error);
    } finally {
      setBusy(false);
    }
  }

  // A 401 means the login session lapsed mid-enrolment -> the branded session-expired state; any other
  // failure is the generic "couldn't start setup".
  function handleSetupError(error: unknown) {
    setStep(error instanceof ApiError && error.status === 401 ? "sessionExpired" : "failed");
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrol || !/^\d{6}$/.test(code) || busy) return;
    setBusy(true);
    setCodeError(null);
    try {
      const result = await apiFetch<EnrolConfirmResponse>("/admin/api/mfa/enrol", {
        method: "POST",
        body: { step: "confirm", factorId: enrol.factorId, code },
      });
      if (result.outcome === "enrolled") setStep("success");
      else if (result.outcome === "too_many_attempts") setStep("paused");
      else setCodeError(M.wrongCode);
    } catch (error) {
      handleSetupError(error);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await apiFetch("/admin/api/sign-out", { method: "POST" });
    } catch (error) {
      // Leave anyway — the next request has no valid session to act on — but report so a persistent
      // sign-out failure is visible (decisions.md, Error handling).
      report("warning", "sign-out request failed; leaving anyway", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load to clear the client session and land on sign-in
    window.location.assign("/admin/sign-in");
  }

  async function copyKey() {
    if (!enrol) return;
    try {
      await navigator.clipboard.writeText(enrol.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Clipboard can be unavailable (permissions/insecure context); the key is visible to type by hand.
      // Report rather than swallow so a surprising failure is not invisible (decisions.md).
      report("debug", "clipboard copy unavailable", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Instructions — the first screen a new administrator sees.
  if (step === "instructions") {
    return (
      <AuthCard aria-labelledby="enrol-title">
        <div className={styles.headingBlock}>
          <h1 id="enrol-title" className={styles.title}>
            {M.title}
          </h1>
          <p className={styles.subtext}>{M.intro}</p>
        </div>
        <ol className={styles.steps}>
          {[M.step1, M.step2, M.step3].map((text, i) => (
            <li key={i} className={styles.stepRow}>
              <span className={styles.stepNum}>{i + 1}</span>
              <span className={styles.stepText}>{text}</span>
            </li>
          ))}
        </ol>
        <Button variant="secondary" className="w-full" onClick={begin} disabled={busy}>
          {M.continueButton}
        </Button>
        <Button variant="ghost" size="inline" type="button" className={styles.textButton} onClick={signOut}>
          {M.signOut}
        </Button>
        <AuthCardFooter>{M.gateNote}</AuthCardFooter>
      </AuthCard>
    );
  }

  // Step 1 — scan the QR code.
  if (step === "scan" && enrol) {
    return (
      <AuthCard aria-labelledby="enrol-scan-title">
        <StepProgress current={1} />
        <div className={styles.headingBlock}>
          <h2 id="enrol-scan-title" className={styles.title}>
            {M.scanTitle}
          </h2>
          <p className={styles.subtext}>{M.scanBody}</p>
        </div>
        <div className={styles.qrRow}>
          <span className={styles.qrFrame}>
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic QR SVG/data-URI from the server; next/image cannot optimize it */}
            <img src={qrSrc(enrol.qrCode)} alt="QR code to add TrackPoli Admin to your authenticator app" width={150} height={150} />
          </span>
        </div>
        <Button variant="ghost" size="inline" type="button" className={styles.textButton} onClick={() => setStep("manual")}>
          {M.enterKeyLink}
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => setStep("code")}>
          {M.continueButton}
        </Button>
        <Button variant="ghost" size="inline" type="button" className={styles.backButton} onClick={() => setStep("instructions")}>
          <Icon src={arrowBackIcon} size={20} />
          <span>{M.back}</span>
        </Button>
      </AuthCard>
    );
  }

  // Step 1 (alt) — enter the setup key by hand.
  if (step === "manual" && enrol) {
    return (
      <AuthCard aria-labelledby="enrol-manual-title">
        <StepProgress current={1} />
        <div className={styles.headingBlock}>
          <h2 id="enrol-manual-title" className={styles.title}>
            {M.manualTitle}
          </h2>
          <p className={styles.subtext}>{M.manualBody}</p>
        </div>
        <div className={styles.keyBox}>
          <span className={styles.keyLabel}>{M.keyLabel}</span>
          <span className={styles.key}>{groupKey(enrol.secret)}</span>
          <Button variant="ghost" size="inline" type="button" className={styles.keyAction} onClick={copyKey}>
            <Icon src={copyIcon} size={18} />
            <span>{copied ? M.copied : M.copyKey}</span>
          </Button>
          <span className={styles.accountLine}>TrackPoli Admin · {email}</span>
        </div>
        <Button variant="ghost" size="inline" type="button" className={styles.textButton} onClick={() => setStep("scan")}>
          {M.scanInsteadLink}
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => setStep("code")}>
          {M.continueButton}
        </Button>
      </AuthCard>
    );
  }

  // Step 2 — enter the 6-digit code.
  if (step === "code" && enrol) {
    const canSubmit = !busy && /^\d{6}$/.test(code);
    return (
      <AuthCard aria-labelledby="enrol-code-title">
        <form className="flex w-full flex-col gap-[22px]" onSubmit={confirm} noValidate>
          <StepProgress current={2} />
          <div className={styles.headingBlock}>
            <h2 id="enrol-code-title" className={styles.title}>
              {M.codeTitle}
            </h2>
            <p className={styles.subtext}>{M.codeBody}</p>
          </div>
          {codeError ? (
            <Alert>
              <Icon src={warningIcon} size={22} />
              <AlertDescription>{codeError}</AlertDescription>
            </Alert>
          ) : null}
          <div className={styles.fields}>
            <div className="flex w-full flex-col gap-1.5">
              <Label htmlFor={codeId}>6-digit code</Label>
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
                aria-invalid={Boolean(codeError) || undefined}
              />
            </div>
          </div>
          <Button variant="secondary" className="w-full" type="submit" disabled={!canSubmit}>
            {M.verifyButton}
          </Button>
          <Button variant="ghost" size="inline" type="button" className={styles.backButton} onClick={() => setStep("scan")}>
            <Icon src={arrowBackIcon} size={20} />
            <span>{M.backToQr}</span>
          </Button>
        </form>
      </AuthCard>
    );
  }

  // Success.
  if (step === "success") {
    return (
      <AuthCard aria-labelledby="enrol-success-title" brandCentered>
        <span className={styles.iconChip} data-tone="ok">
          <Icon src={checkIcon} size={30} />
        </span>
        <div className={styles.headingBlock} data-center>
          <h1 id="enrol-success-title" className={styles.title}>
            {M.successTitle}
          </h1>
          <p className={styles.subtext}>{M.successBody}</p>
        </div>
        <div className={styles.infoRow}>
          <Icon src={phoneIcon} size={22} />
          <span>{M.successRecovery}</span>
        </div>
        <Button
          variant="secondary" className="w-full"
          onClick={() => {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the aal2 session is applied and the dashboard renders
            window.location.assign("/admin");
          }}
        >
          {M.goToDashboard}
        </Button>
      </AuthCard>
    );
  }

  // Too many attempts — setup paused.
  if (step === "paused") {
    return (
      <AuthCard aria-labelledby="enrol-paused-title" brandCentered>
        <span className={styles.iconChip}>
          <Icon src={lockIcon} size={30} />
        </span>
        <div className={styles.headingBlock} data-center>
          <h1 id="enrol-paused-title" className={styles.title}>
            {M.pausedTitle}
          </h1>
          <p className={styles.subtext}>{M.pausedBody}</p>
        </div>
        <div className={styles.infoRow}>
          <Icon src={lockIcon} size={22} />
          <span>{M.pausedRetry}</span>
        </div>
        <Button variant="secondary" className="w-full" onClick={signOut}>
          {M.signOut}
        </Button>
        <AuthCardFooter>{M.pausedHelp}</AuthCardFooter>
      </AuthCard>
    );
  }

  // Setup session expired — signed out by inactivity before enrolment finished.
  if (step === "sessionExpired") {
    return (
      <AuthCard aria-labelledby="enrol-expired-title" brandCentered>
        <span className={styles.iconChip}>
          <Icon src={clockIcon} size={30} />
        </span>
        <div className={styles.headingBlock} data-center>
          <h1 id="enrol-expired-title" className={styles.title}>
            {M.sessionExpiredTitle}
          </h1>
          <p className={styles.subtext}>{M.sessionExpiredBody}</p>
        </div>
        <Button
          variant="secondary" className="w-full"
          onClick={() => {
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load back to sign-in; the lapsed session is already gone
            window.location.assign("/admin/sign-in");
          }}
        >
          {M.signInAgain}
        </Button>
        <AuthCardFooter>{M.sessionExpiredNote}</AuthCardFooter>
      </AuthCard>
    );
  }

  // Could not start setup (begin() / confirm() transport failure).
  return (
    <AuthCard aria-labelledby="enrol-failed-title" brandCentered>
      <span className={styles.iconChip}>
        <Icon src={errorIcon} size={30} />
      </span>
      <div className={styles.headingBlock} data-center>
        <h1 id="enrol-failed-title" className={styles.title}>
          {M.failedTitle}
        </h1>
        <p className={styles.subtext}>{M.failedBody}</p>
      </div>
      <Button variant="secondary" className="w-full" onClick={begin} disabled={busy}>
        {M.tryAgain}
      </Button>
      <Button variant="ghost" size="inline" type="button" className={styles.textButton} onClick={signOut}>
        {M.signOut}
      </Button>
      <AuthCardFooter>{M.failedHelp}</AuthCardFooter>
    </AuthCard>
  );
}

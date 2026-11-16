"use client";

// The shared /auth/confirm Continue page (Figma 1275:3830, 1276:3876, 1276:3914), reused by TP1-09. An
// email recovery/invite link lands here carrying a single-use token_hash. The token is exchanged ONLY when
// the person clicks Continue (a POST), never on page load — so an email security scanner that merely fetches
// the URL cannot consume the one-time link (ADR-0008, OWASP Forgot Password). On success the recovery
// session is set and we go to the reset screen; a used/expired/invalid link shows the expired state, and an
// unexpected failure shows the error state. Presentation + wiring only.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/lib/apiFetch";
import { AuthCard, AuthCardFooter } from "./AuthCard";
import clockIcon from "./assets/clock-lg.svg";
import errorIcon from "./assets/error.svg";
import arrowBackIcon from "./assets/arrow-back.svg";

type ConfirmResponse = { outcome: "ok" } | { outcome: "expired" } | { outcome: "error" };

type Status = "idle" | "verifying" | "expired" | "error";

function BackToSignIn() {
  return (
    <div className="flex w-full justify-center">
      <a
        href="/admin/sign-in"
        className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 no-underline hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <Icon src={arrowBackIcon} size={20} />
        <span className="font-sans text-[length:var(--md-label-large-size)] font-medium leading-[var(--md-label-large-line)] tracking-[var(--md-label-large-tracking)] text-primary">
          Back to sign in
        </span>
      </a>
    </div>
  );
}

// The expired and error states share one layout: an icon chip, heading, body, a primary action, back. The
// primary action differs by link type: a recovery link can be re-requested by the person (→ forgot-password),
// but an invitation cannot be self-requested — an invited person is sent back to sign-in and told to ask an
// Administrator Manager (the copy carries that), so both the label and the destination are passed in.
function ResultCard({
  icon,
  title,
  body,
  primaryLabel,
  primaryHref,
}: {
  icon: typeof clockIcon;
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
}) {
  return (
    <AuthCard aria-labelledby="confirm-result-title" brandCentered>
        <div className="flex w-full justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent">
            <Icon src={icon} size={30} />
          </span>
        </div>
        <div className="flex w-full flex-col gap-2 text-center">
          <h1
            id="confirm-result-title"
            className="m-0 font-sans text-[length:var(--md-headline-medium-size)] font-normal leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)] text-foreground"
          >
            {title}
          </h1>
          <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
            {body}
          </p>
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            window.location.assign(primaryHref);
          }}
        >
          {primaryLabel}
        </Button>
        <BackToSignIn />
    </AuthCard>
  );
}

export function ConfirmPage({ tokenHash, type }: { tokenHash: string | null; type: string | null }) {
  // No token means there is nothing to confirm — treat it as an invalid/expired link.
  const [status, setStatus] = useState<Status>(tokenHash ? "idle" : "expired");

  // One Continue page serves both the recovery link and the invite link (TP1-09). The type decides the
  // copy, where a successful exchange lands, and what the expired/error primary action offers.
  const isInvite = type === "invite";
  const copy = isInvite
    ? {
        continueTitle: "Accept your invitation",
        continueBody: "Select Continue to set up your TrackPoli Admin account.",
        expiredTitle: "This invitation has expired",
        expiredBody:
          "Invitations can be used only once and expire after 24 hours. Ask an Administrator Manager to send you a new one.",
        errorBody: "We couldn't open your invitation link. Ask an Administrator Manager to send you a new one.",
        destination: "/admin/accept-invite",
        primaryLabel: "Back to sign in",
        primaryHref: "/admin/sign-in",
      }
    : {
        continueTitle: "Continue to reset password",
        continueBody: "Select Continue to reset your TrackPoli Admin account password.",
        expiredTitle: "This link has expired",
        expiredBody:
          "Password reset links can be used only once and expire after 24 hours. Request a new link to continue.",
        errorBody: "We couldn't open your reset link. Please request a new one and try again.",
        destination: "/admin/reset-password",
        primaryLabel: "Request a new link",
        primaryHref: "/admin/forgot-password",
      };

  if (status === "expired") {
    return (
      <ResultCard
        icon={clockIcon}
        title={copy.expiredTitle}
        body={copy.expiredBody}
        primaryLabel={copy.primaryLabel}
        primaryHref={copy.primaryHref}
      />
    );
  }
  if (status === "error") {
    return (
      <ResultCard
        icon={errorIcon}
        title="Something went wrong"
        body={copy.errorBody}
        primaryLabel={copy.primaryLabel}
        primaryHref={copy.primaryHref}
      />
    );
  }

  async function onContinue() {
    setStatus("verifying");
    try {
      const result = await apiFetch<ConfirmResponse>("/admin/api/auth/confirm", {
        method: "POST",
        body: { tokenHash, type: type ?? "recovery" },
      });
      if (result.outcome === "ok") {
        // The session is set; go to the right screen (full load so the new session cookie applies): the
        // invited user to /accept-invite (set password/Google → activate), a recovery user to /reset-password.
        window.location.assign(copy.destination);
        return;
      }
      setStatus(result.outcome === "expired" ? "expired" : "error");
    } catch {
      setStatus("error");
    }
  }

  const verifying = status === "verifying";
  return (
    <AuthCard aria-labelledby="confirm-title" brandCentered>
        <div className="flex w-full flex-col gap-2 text-center">
          <h1
            id="confirm-title"
            className="m-0 font-sans text-[length:var(--md-headline-medium-size)] font-normal leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)] text-foreground"
          >
            {copy.continueTitle}
          </h1>
          <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
            {copy.continueBody}
          </p>
        </div>
        <Button variant="secondary" className="w-full" onClick={onContinue} disabled={verifying}>
          {verifying ? "Verifying…" : "Continue"}
        </Button>
        <div className="flex w-full justify-center">
          <a
            href="/admin/sign-in"
            className="inline-flex h-11 items-center rounded-full px-3 no-underline font-sans text-[length:var(--md-label-large-size)] font-medium leading-[var(--md-label-large-line)] tracking-[var(--md-label-large-tracking)] text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Cancel
          </a>
        </div>
        <AuthCardFooter>This link can be used only once and expires 24 hours after it was sent.</AuthCardFooter>
    </AuthCard>
  );
}

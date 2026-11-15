"use client";

// The "check your email" screen shown after a forgot-password request (Figma node 1274:3734, "Reset
// password link sent"). It is shown identically whether or not the submitted email has an account — the
// backend returns the same "sent" outcome for both — so it never reveals whether the address is registered
// (ADR-0008, OWASP Forgot Password). The copy is the enumeration-safe CONDITIONAL form ("If an account
// exists …"), matching the request acknowledgement, rather than a definitive "a link was sent to you".
// Pure presentation; the parent (ForgotPasswordPage) owns the submitted email. Shell = AuthCard; content
// layout is design-system Tailwind utilities (ADR-0028 follow-up; the per-screen CSS Module is retired).

import { Icon } from "@/components/ui/Icon";
import { AuthCard } from "./AuthCard";
import mailIcon from "./assets/mail.svg";
import arrowBackIcon from "./assets/arrow-back.svg";

export function ForgotPasswordSentPage({ email }: { email: string }) {
  return (
    <AuthCard aria-labelledby="sent-title" brandCentered>
      <div className="flex w-full justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent">
          <Icon src={mailIcon} size={24} />
        </span>
      </div>

      <div className="flex w-full flex-col gap-2 text-center">
        <h1
          id="sent-title"
          className="m-0 font-sans text-[length:var(--md-headline-medium-size)] font-normal leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)] text-foreground"
        >
          Check your email
        </h1>
        <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
          If an account exists for {email}, a password reset link is on its way.
          <br />
          Reset links expire after 24 hours and can be used only once.
        </p>
      </div>

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
    </AuthCard>
  );
}

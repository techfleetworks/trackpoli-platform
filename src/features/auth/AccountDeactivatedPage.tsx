"use client";

// The account-deactivated screen (TP1-09 follow-up, P1-08; ADR-0020/0021). The browser lands here when a
// session's authoritative status is "deactivated" — a manager removed this administrator's access. Before this
// screen existed, the (app) layout silently redirected a deactivated session to /sign-in, where the still-valid
// credentials let them sign in and get bounced again: a confusing loop with no explanation. This screen ends
// that by telling them what happened and offering the way back to sign-in.
//
// It mirrors the session-expired screen (TP1-05) deliberately — same AuthCard shell, a decorative icon, a
// heading + body, and a best-effort sign-out fired ON MOUNT so the server session is actively destroyed even
// when the browser arrived here by a server redirect with no client running beforehand (OWASP Session
// Management: destroy the session, not just show a screen). That self-destruct also closes the ADR-0021
// best-effort-session-kill gap: if the manager-side deactivation failed to revoke this session, landing here
// revokes it. Presentation + that one revoke; this screen makes NO authorization decision — RLS (migration 005)
// already denies a deactivated session every row regardless of what renders here (ADR-0012).

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/lib/apiFetch";
import { report } from "@/lib/report";
import { ACCOUNT_MESSAGES as M } from "@/features/auth/messages";
import { AuthCard, AuthCardFooter } from "./AuthCard";
import lockIcon from "./assets/lock.svg";

export function AccountDeactivatedPage() {
  useEffect(() => {
    void (async () => {
      try {
        await apiFetch("/admin/api/sign-out", { method: "POST" });
      } catch (error) {
        report("debug", "deactivated sign-out ping failed", {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, []);

  return (
    <AuthCard brandCentered>
      <div className="flex w-full justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent">
          <Icon src={lockIcon} size={30} />
        </span>
      </div>

      <div className="flex w-full flex-col gap-2 text-center">
        <h1 className="m-0 font-sans text-[length:var(--md-headline-medium-size)] font-normal leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)] text-foreground">
          {M.deactivatedTitle}
        </h1>
        <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
          {M.deactivatedBody}
        </p>
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          // Raw browser nav keeps the literal "/admin" basePath (window.location adds none — decisions.md); a
          // full load clears the client session and re-runs the middleware from a clean slate, the same idiom
          // the MFA-enrol and session-expired screens use after an auth-state change.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load to clear the client session and land on sign-in
          window.location.assign("/admin/sign-in");
        }}
      >
        {M.backToSignIn}
      </Button>

      <AuthCardFooter>{M.deactivatedFootnote}</AuthCardFooter>
    </AuthCard>
  );
}

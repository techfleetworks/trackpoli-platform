"use client";

// The session-expired screen (TP1-05; Figma 1211:2489). The browser lands here after a timeout: the idle
// limit (copy "expired after inactivity") or the 4-hour absolute cap (copy "reached its 4-hour limit"),
// chosen by the ?reason the middleware set. "Sign in again" returns to the sign-in screen, keeping the
// original path (?next) so the administrator comes back where they were — the return path is sanitised to an
// in-app /admin path so it can never be used as an open redirect (OWASP Unvalidated Redirects).
//
// On mount it fires a best-effort sign-out so the server session is actively destroyed even when the browser
// arrived here by a middleware redirect with no client running beforehand (OWASP Session Management: destroy
// the session, not just the cookie). Presentation + that one revoke; no session decision is made here.

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/LegacyButton";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/lib/apiFetch";
import { report } from "@/lib/report";
import { SESSION_MESSAGES as M } from "@/features/auth/messages";
import { AuthCard, AuthCardFooter } from "../AuthCard";
import clockIcon from "../assets/clock.svg";

/** Keep only an in-app admin path, so a crafted ?next cannot redirect off-site (open redirect). */
function safeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/admin/") || next.startsWith("/admin//")) return null;
  return next;
}

export function SessionExpiredPage() {
  const params = useSearchParams();
  const isAbsolute = params.get("reason") === "absolute";
  const next = safeNext(params.get("next"));
  const signInHref = next ? `/admin/sign-in?next=${encodeURIComponent(next)}` : "/admin/sign-in";

  useEffect(() => {
    void (async () => {
      try {
        await apiFetch("/admin/api/sign-out", { method: "POST" });
      } catch (error) {
        report("debug", "session-expired sign-out ping failed", {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, []);

  return (
    <AuthCard brandCentered>
        <div className="flex w-full justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent">
            <Icon src={clockIcon} size={30} />
          </span>
        </div>

        <div className="flex w-full flex-col gap-2 text-center">
          <h1 className="m-0 font-sans text-[length:var(--md-headline-medium-size)] font-normal leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)] text-foreground">
            {isAbsolute ? M.expiredAbsoluteTitle : M.expiredIdleTitle}
          </h1>
          <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
            {isAbsolute ? M.expiredAbsoluteBody : M.expiredIdleBody}
          </p>
        </div>

        <Button
          variant="filled"
          className="w-full"
          onClick={() => {
            window.location.assign(signInHref);
          }}
        >
          {M.signInAgain}
        </Button>

        <AuthCardFooter>{M.expiredFootnote}</AuthCardFooter>
    </AuthCard>
  );
}

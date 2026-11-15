"use client";

// The "Account temporarily locked" view (ADR-0005 / Figma locked screen), shown when a sign-in attempt
// comes back with outcome "locked". It states the pause generically (no account detail), tells the user
// when they can try again (derived from lockedUntil), and offers a way back to the form. Pure presentation.
// Shell = AuthCard; content layout is design-system Tailwind utilities (ADR-0028 follow-up; per-screen
// CSS Module retired).

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/Icon";
import { formatTimeUntil } from "@/lib/relativeTime";
import { AuthCard, AuthCardFooter } from "./AuthCard";
import lockIcon from "./assets/lock.svg";
import clockIcon from "./assets/clock.svg";

export function AccountLockedCard({ lockedUntil, onBack }: { lockedUntil: string | null; onBack: () => void }) {
  return (
    <AuthCard aria-labelledby="locked-title" brandCentered>
      <div className="flex w-full justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent">
          <Icon src={lockIcon} size={30} />
        </span>
      </div>

      <div className="flex w-full flex-col gap-2 text-center">
        <h1
          id="locked-title"
          className="m-0 font-sans text-[length:var(--md-headline-medium-size)] font-normal leading-[var(--md-headline-medium-line)] tracking-[var(--md-headline-medium-tracking)] text-foreground"
        >
          Account temporarily locked
        </h1>
        <p className="m-0 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-muted-foreground">
          Too many failed sign-in attempts. For your security, access to this account has been paused.
        </p>
      </div>

      <div className="flex w-full items-center gap-3 rounded-lg bg-accent px-4 py-3.5">
        <Icon src={clockIcon} size={22} />
        <p className="m-0 min-w-0 flex-1 font-sans text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)] text-foreground">
          You can try signing in again {formatTimeUntil(lockedUntil)}.
        </p>
      </div>

      <Button variant="secondary" className="w-full" onClick={onBack}>
        Back to sign in
      </Button>

      <AuthCardFooter>
        If you believe this is a mistake, contact a super administrator to unlock your account.
      </AuthCardFooter>
    </AuthCard>
  );
}

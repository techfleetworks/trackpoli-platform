import { Suspense } from "react";

import { ChangePasswordCard } from "./ChangePasswordCard";
import { TwoFactorCard } from "./TwoFactorCard";
import { ActiveSessionsCard } from "./ActiveSessionsCard";
import type { TwoFactorStatus } from "./twoFactor";

// The Settings Security tab (TP1-11, P1-14). It composes the three security cards in one place: change
// password (TP1-11, hidden for a Google-only account), replace two-factor device (TP1-04), and sign out
// other sessions (TP1-05). The two existing cards are reused as-is — this ticket places them in the tab, it
// does not rewrite them. TwoFactorCard reads the ?reauth return param via useSearchParams (the Google device-
// replacement round-trip returns to this page), so it sits inside a Suspense boundary, exactly as the former
// standalone /settings/security page did. `status` is read on the server and passed down; no data access here.

export function SecurityTab({ status }: { status: TwoFactorStatus }) {
  return (
    <div className="flex flex-col gap-6">
      <ChangePasswordCard accountType={status.accountType} />
      <Suspense>
        <TwoFactorCard
          enrolled={status.enrolled}
          accountType={status.accountType}
          isManager={status.isManager}
        />
      </Suspense>
      <ActiveSessionsCard />
    </div>
  );
}

import type { Metadata } from "next";
import { AccountDeactivatedPage } from "@/features/auth/AccountDeactivatedPage";

export const metadata: Metadata = {
  title: "Account deactivated · TrackPoli Admin",
};

// The account-deactivated landing (TP1-09 follow-up, P1-08). It sits OUTSIDE the (app) route group — a
// pre-app gate like sign-in, /terms, /accept-invite and /session-expired — so it renders without the admin
// shell. It is a public path (MFA_PUBLIC_PATHS): a deactivated session is redirected here by the (app) layout
// and the RequireActive guard, and the screen then destroys the session on mount, so the page must render with
// OR without a session and must not be caught by the terms/invite/two-factor funnel. It reads no search params,
// so no Suspense boundary is needed (unlike /session-expired).
export default function Page() {
  return <AccountDeactivatedPage />;
}

import { redirect } from "next/navigation";

import { requireUser } from "@/features/auth/session";
import { AcceptInvitePage } from "@/features/auth/AcceptInvitePage";

// The accept-invite screen route (TP1-09, P1-08). It sits OUTSIDE the (app) route group — a pre-app gate like
// sign-in, /terms and the MFA funnel — so it renders without the admin shell. The invited session is
// established by the /auth/confirm Continue page (type=invite); the middleware invite gate funnels an invited
// session here (after terms, before two-factor). This server page guards defensively: an already-active user
// has nothing to activate, so they are sent on into the app rather than shown a password-reset-shaped form
// (setting a password here is for activation only). The email is fixed to the session's address.

export default async function Page() {
  const user = await requireUser(); // redirects to sign-in when there is no session
  // Cosmetic early-exit: an active caller (by the token claim) is sent into the app so they never see the
  // activation form (basePath-relative; Next adds /admin, ADR-0014). The claim can lag a just-activated
  // session, so this is NOT the guard — the /admin/api/accept-invite route reads the LIVE status and refuses
  // to change an already-active account's password (judge-arch L1), and the middleware invite gate routes on
  // live status too. So a stale claim here only means a harmless extra render, never a stray credential change.
  if (user.status === "active") redirect("/");

  return <AcceptInvitePage email={user.email ?? ""} />;
}

import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { decideRequireActive } from "@/features/auth/guards/decisions";
import { AppShell } from "@/features/shell/AppShell";
import { shellDisplayName } from "@/features/shell/displayName";

// The authenticated route group's layout (TP1-06). Every page inside it renders within the admin shell and
// behind the session + active guards. Enforcement is layered (ADR-0012): the middleware already redirected an
// unauthenticated/unverified/manager-forbidden request before this runs; this is the server-side defense that
// also holds when middleware is bypassed, and RLS is the real boundary for the data. Role gating for the
// manager route lives on that route itself; here we only require a signed-in, non-deactivated administrator.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // redirects to sign-in when there is no session
  const active = decideRequireActive({ authenticated: true, status: user.status });
  // A deactivated session is shown the account-deactivated screen (TP1-09 follow-up), which explains the removal
  // and destroys the session, instead of the old silent bounce to /sign-in (a confusing re-sign-in loop). RLS
  // (migration 005) already denies a deactivated session every row, so this is routing/UX only (ADR-0012).
  if (active === "deactivated") redirect("/deactivated");
  // "onboarding" (invited) normally never reaches here — the middleware invite gate funnels it to
  // /accept-invite first (TP1-09, ADR-0020). If middleware is bypassed an invited result falls through and
  // renders the shell, but RLS (migration 005) confines an invited session to its own profile row, so that is
  // a cosmetic gap, not an exposure; the real invite handling is the gate, not this layout. "allow" renders.

  return <AppShell displayName={shellDisplayName(user)}>{children}</AppShell>;
}

import { redirect } from "next/navigation";

import { requireUser } from "@/features/auth/session";
import { TermsAcceptance } from "@/features/terms/TermsAcceptance";
import { readTermsScreenData } from "@/features/terms/termsData";

// The terms & privacy acceptance screen route (TP1-08, Q-1-20). It sits OUTSIDE the (app) route group — a
// pre-app gate like sign-in and the MFA funnel — so it renders without the admin shell. The middleware terms
// gate already funnels an un-accepted session here; this is the server-side read + defense: it loads the
// current versions and whether the user has already accepted (reading its own acceptances needs the
// service role at aal1, so it goes through readTermsScreenData), and sends an already-accepted user on into
// the app. The restrictive RLS remains the authorization boundary (ADR-0012).

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ stale?: string }>;
}) {
  const user = await requireUser(); // redirects to sign-in when there is no session
  const data = await readTermsScreenData(user.id);

  // Already accepted the current versions: nothing to do here, continue into the app (basePath-relative;
  // Next adds /admin, ADR-0014). The middleware would also allow them through, but skipping the screen is
  // the right UX and avoids a flash of the form.
  if (data.alreadyAccepted) redirect("/");

  const { stale } = await searchParams;

  return (
    <TermsAcceptance
      policies={data.policies.map((policy) => ({
        document: policy.document,
        label: policy.label,
        version: policy.version,
        isPlaceholder: policy.isPlaceholder,
        body: policy.body,
      }))}
      variant={data.hasPriorAcceptance ? "reaccept" : "first"}
      staleBanner={stale === "1"}
    />
  );
}

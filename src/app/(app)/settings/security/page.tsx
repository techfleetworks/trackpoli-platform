import { redirect } from "next/navigation";

// /settings/security is now the Security TAB of the unified Settings page (TP1-11, P1-14). This route is kept
// as a redirect so two things keep working without touching the auth routes: existing deep links/bookmarks,
// and — importantly — the Google device-replacement re-authentication round-trip, which returns to
// /admin/settings/security?reauth=ok|mismatch|error from the OAuth callback (unchanged). We forward the
// reauth param so the replacement wizard, now mounted inside the Security tab, resumes exactly as before.
// redirect() in a Server Component takes an app-relative path (basePath is added by Next), matching
// requireUser()'s redirect("/sign-in").

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reauth?: string | string[] }>;
}) {
  const { reauth } = await searchParams;
  const value = Array.isArray(reauth) ? reauth[0] : reauth;
  redirect(value ? `/settings?tab=security&reauth=${encodeURIComponent(value)}` : "/settings?tab=security");
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { MANAGER_ROLE } from "@/lib/roles";
import { AdminList } from "@/features/admins/AdminList";

export const metadata: Metadata = { title: "Admin management · TrackPoli Admin" };

// The manager-only Admin management route (TP1-06/TP1-10, E2E-08). The middleware already redirects a
// non-manager to /forbidden; this server-side role check is the defence-in-depth that also holds if middleware
// is bypassed, and the list's data service + RLS are the real boundary (ADR-0012). The client AdminList loads
// the administrators and hosts the action dialogs (TP1-10, P1-13).
export default async function Page() {
  const user = await requireUser();
  // basePath-relative path (next/navigation redirect() prepends "/admin"); ?from is display-only, so it keeps the real /admin path.
  if (user.role !== MANAGER_ROLE) redirect("/forbidden?from=/admin/admins");
  return <AdminList />;
}

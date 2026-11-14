import type { Metadata } from "next";
import { requireUser } from "@/features/auth/session";
import { getTwoFactorStatus } from "@/features/settings/security/twoFactor";
import { getProfileDetails, getAcceptedPolicies } from "@/features/settings/profile/profileData";
import { SettingsTabs, type SettingsTab } from "@/features/settings/SettingsTabs";
import { MANAGER_ROLE } from "@/lib/roles";

export const metadata: Metadata = { title: "Settings · TrackPoli Admin" };

// The unified Settings page (TP1-11, P1-14). Reaching it already requires aal2 (RequireMfa routes a sub-aal2
// session to enrol/verify, and RLS denies aal1 data regardless, ADR-0009), so the signed-in administrator can
// read their own profile and policy_acceptances directly under RLS. This page OWNS the reads and hands plain
// data to the client SettingsTabs shell (decisions.md: UI → data/service, never UI → backend). The initial
// tab is taken from ?tab, clamped to a value the role may see (Workspace rules is manager-only) before it
// reaches the client, so the /settings/security redirect and any deep link land on the right tab.

function resolveTab(raw: string | string[] | undefined, isManager: boolean): SettingsTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "security" || value === "notifications" || value === "preferences") return value;
  if (value === "workspace") return isManager ? "workspace" : "profile";
  return "profile";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const user = await requireUser();
  const [twoFactor, profile, acceptances] = await Promise.all([
    getTwoFactorStatus(),
    getProfileDetails(),
    getAcceptedPolicies(),
  ]);
  const isManager = user.role === MANAGER_ROLE;
  const { tab } = await searchParams;

  return (
    <SettingsTabs
      role={user.role}
      email={user.email}
      profile={profile}
      acceptances={acceptances}
      twoFactor={twoFactor}
      initialTab={resolveTab(tab, isManager)}
    />
  );
}

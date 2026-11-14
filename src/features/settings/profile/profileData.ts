import "server-only";

// Server-side reads for the Settings Profile tab (TP1-11, P1-14). The page renders; these own the reads so no
// Supabase access lives in the component (decisions.md: UI -> data/service, never UI -> backend). The Settings
// page runs at aal2 (behind RequireMfa), so the signed-in administrator can read their own profile row and
// their own policy_acceptances directly under RLS (profiles_select_own, acceptances_select_own) — no
// service-role client is needed here (unlike the aal1 /terms screen).

import { createServerSupabase } from "@/lib/supabase/server";
import { report } from "@/lib/report";
import type { AcceptedPolicy } from "@/features/terms/AcceptedPolicies";
import type { PolicyDocument } from "@/features/terms/policies";

export interface ProfileDetails {
  readonly displayName: string;
  /** When the administrator was added (profiles.created_at), or null if unreadable. */
  readonly createdAt: string | null;
  /** Last successful sign-in (profiles.last_sign_in_at), or null if they have never signed in. */
  readonly lastSignInAt: string | null;
}

export async function getProfileDetails(): Promise<ProfileDetails | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, created_at, last_sign_in_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) {
    if (error) report("warning", "profile details read failed", { reason: error.message });
    return null;
  }
  return { displayName: data.display_name, createdAt: data.created_at, lastSignInAt: data.last_sign_in_at };
}

export async function getAcceptedPolicies(): Promise<AcceptedPolicy[]> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("policy_acceptances")
    .select("document, version, accepted_at")
    .eq("admin_id", user.id)
    .order("accepted_at", { ascending: false });
  if (error) {
    report("warning", "accepted policies read failed", { reason: error.message });
    return [];
  }
  return (data ?? []).map((row) => ({
    document: row.document as PolicyDocument,
    version: row.version,
    acceptedAt: row.accepted_at,
  }));
}

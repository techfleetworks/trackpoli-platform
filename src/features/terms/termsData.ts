import "server-only";

// Server-side read for the /terms screen (TP1-08). The restrictive RLS own-row acceptance policy requires
// aal2 (migration 009), but the terms screen runs at aal1 (before the two-factor code), so the signed-in
// user cannot read their own policy_acceptances yet. This owns that read through the canonical service-role
// client (src/lib/supabase/admin.ts) — the one place terms data is read for the screen, so the page itself
// never touches Supabase (components/pages rule). It reads only what the screen needs and returns no PII.

import { createAdminSupabase } from "@/lib/supabase/admin";
import { report } from "@/lib/report";
import { POLICY_DOCUMENTS, resolvePolicyContent, type PolicyContent, type PolicyDocument } from "./policies";

export interface TermsScreenData {
  /** The current documents (terms + privacy) with their versions and bodies, in a stable order. */
  readonly policies: readonly PolicyContent[];
  /** True when the user has accepted the CURRENT version of every document (then the screen is skipped). */
  readonly alreadyAccepted: boolean;
  /** True when the user has accepted some earlier version (drives the "we've updated our terms" variant). */
  readonly hasPriorAcceptance: boolean;
}

export async function readTermsScreenData(userId: string): Promise<TermsScreenData> {
  const admin = createAdminSupabase();

  const { data: versionRows, error: versionsError } = await admin
    .from("policy_versions")
    .select("document,current_version");
  if (versionsError) {
    // Degrade to the version-"0" fallback below, but never silently: a failed read here would re-show the
    // form, so report it through the spine so a genuine data-layer fault is visible (decisions.md, Error
    // handling). The restrictive RLS still blocks the data regardless.
    report("warning", "terms screen: policy_versions read failed", { reason: versionsError.message });
  }
  const currentVersion = new Map<PolicyDocument, string>();
  for (const row of versionRows ?? []) {
    currentVersion.set(row.document as PolicyDocument, row.current_version);
  }
  // Both documents are seeded at version "0" (migration 009); fall back to "0" if a row is somehow missing.
  const policies = POLICY_DOCUMENTS.map((document) =>
    resolvePolicyContent(document, currentVersion.get(document) ?? "0"),
  );

  const { data: acceptanceRows, error: acceptancesError } = await admin
    .from("policy_acceptances")
    .select("document,version")
    .eq("admin_id", userId);
  if (acceptancesError) {
    // A failed read degrades to "not accepted" (re-show the form) rather than wrongly letting someone past;
    // report it so the fault is not silent (decisions.md, Error handling).
    report("warning", "terms screen: policy_acceptances read failed", { reason: acceptancesError.message });
  }
  const acceptances = acceptanceRows ?? [];

  const hasPriorAcceptance = acceptances.length > 0;
  const alreadyAccepted = POLICY_DOCUMENTS.every((document) =>
    acceptances.some(
      (row) => row.document === document && row.version === (currentVersion.get(document) ?? "0"),
    ),
  );

  return { policies, alreadyAccepted, hasPriorAcceptance };
}

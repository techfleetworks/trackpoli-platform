// Admin-side identity helpers (TP1-10). Unlinking a linked OAuth identity is not exposed by the supabase-js
// admin client, so the unlink calls the GoTrue admin REST endpoint directly, reading the service credentials
// HERE in _shared — never in a handler, the same boundary getAdminClient keeps in auth.ts (arch-gate allows
// SUPABASE_SERVICE_ROLE_KEY only under _shared/).
//
// LIMITATION (ADR-0021, docs/TODO.md): this path is unverified against a live Google-linked account, because
// Google OAuth is domain-blocked (Q-1-21) and no live Supabase stack runs in CI. Detection reuses the
// established getUserById().identities pattern (request-password-reset); the REST unlink is best-effort and
// its failure is surfaced by the caller, never silently swallowed.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type UnlinkOutcome = "unlinked" | "not_linked";

export async function unlinkProviderIdentity(
  admin: SupabaseClient,
  userId: string,
  provider: string,
): Promise<UnlinkOutcome> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) throw error ?? new Error("could not read the user's identities");
  const identity = (data.user.identities ?? []).find((i) => i.provider === provider);
  if (!identity) return "not_linked";

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const identityId = (identity as { identity_id?: string; id?: string }).identity_id ?? identity.id;
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}/identities/${identityId}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`identity unlink failed (${res.status})`);
  return "unlinked";
}

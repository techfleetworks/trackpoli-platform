// Session side-effects shared by the privileged admin-management functions (TP1-10). Revoking a target's
// sessions forces their next request to re-read role/status; it is best-effort by design, because the
// authoritative control is always the profile status + RLS, never the session or the token claim.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { reportNonFatal } from "./events.ts";

// Revoke a user's sessions so their next request re-reads role/status (revoke_user_sessions, migration 008).
// Best-effort: the access token lives only 5 minutes (NFR-S5) and RLS reads role/status live, so a failed
// revoke delays a claim refresh at most briefly and never widens access. A failure is reported (never
// swallowed), and the calling change still succeeds.
export async function revokeSessions(
  admin: SupabaseClient,
  userId: string,
  ctx: { component: string; requestId: string },
): Promise<void> {
  const { error } = await admin.rpc("revoke_user_sessions", { p_user: userId });
  if (error) {
    await reportNonFatal(admin, {
      component: ctx.component,
      requestId: ctx.requestId,
      errorCode: "revoke_sessions_failed",
      message: "revoke_user_sessions failed",
      actor: userId,
    });
  }
}

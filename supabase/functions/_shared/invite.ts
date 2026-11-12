// Provision an invited administrator: create the auth user, send the invite email, and insert the profile
// in status 'invited'. Shared by invite-admin (the first invite) and recreate-admin (re-invite after a lost
// authenticator, TP1-10), so the two callers never duplicate the create-user + insert-profile + rollback
// steps (pattern-decision: a shared routine for a copied multi-step workflow — decisions.md, boundary).
//
// The CALLER keeps the parts that differ between them: the email-in-use pre-check, and the audit event with
// its own rollback (invite-admin writes admin.invited and fully undoes on event failure; recreate-admin
// writes admin.account_recreated and, because the old account is already gone, reports-and-retries instead).
// On a failed profile insert this routine deletes the just-created auth user so no orphan lingers; it never
// writes an audit event itself.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { AppError } from "./errors.ts";

export type AdminRole = "admin" | "admin_manager";

export async function provisionInvitedAdmin(
  admin: SupabaseClient,
  input: { email: string; displayName: string; role: AdminRole; invitedBy: string },
): Promise<{ id: string }> {
  // The redirect target is validated against the project's allow-list; the link the recipient actually
  // clicks is the token-hash /auth/confirm link in the email template, so an email scanner cannot consume
  // the one-time link (ADR-0020).
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { display_name: input.displayName },
    redirectTo: `${appUrl}/accept-invite`,
  });
  if (inviteError || !invited?.user) {
    throw new AppError("internal", "Could not send the invite");
  }
  const newId = invited.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: newId,
    email: input.email,
    display_name: input.displayName,
    role: input.role,
    status: "invited",
    invited_by: input.invitedBy,
    invited_at: new Date().toISOString(),
  });
  if (profileError) {
    // The contract's rollback: delete the just-created auth user so no orphaned account remains.
    await admin.auth.admin.deleteUser(newId).catch(() => undefined);
    throw new AppError("internal", "Could not create the administrator profile");
  }
  return { id: newId };
}

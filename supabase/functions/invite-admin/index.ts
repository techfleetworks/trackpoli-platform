// invite-admin: an Administrator Manager invites a new administrator by email (TP1-09, P1-08). A POST-
// authentication, MANAGER-only function — it composes verifyCaller({ requireAal2: true }) and additionally
// requires the manager role (access is decided from profiles, not a token claim; AGENTS.md).
//
// It rejects an email already held by a non-deactivated profile (email_in_use), creates the auth user and
// sends the invite email via inviteUserByEmail, then inserts the profile with status 'invited'. The invite
// email links to the /auth/confirm Continue page carrying the single-use token hash (ADR for TP1-09), which
// exchanges it for an invited session and sends the person to /accept-invite. If the profile insert fails,
// the just-created auth user is deleted so a half-created account never lingers (the rollback the contract
// requires). The change and its audit event are atomic: if writeEvent fails, the profile and auth user are
// undone and the call returns internal.

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { writeEvent } from "../_shared/events.ts";
import { AppError } from "../_shared/errors.ts";

const Body = z
  .object({
    email: z.string().email().transform((s) => s.trim().toLowerCase()),
    display_name: z.string().trim().min(1).max(120),
    role: z.enum(["admin", "admin_manager"]),
  })
  .strict();

serve("invite-admin", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { requireAal2: true });
  if (caller.role !== "admin_manager") {
    throw new AppError("forbidden", "Only an Administrator Manager can invite administrators");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError("validation_failed", "Invalid request", parsed.error.issues[0]?.path.join("."));
  }
  const { email, display_name, role } = parsed.data;

  // An email already held by an active or invited administrator cannot be re-invited (a deactivated one can
  // be: that address is free again). The citext unique index on profiles.email is the hard backstop.
  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("id,status")
    .eq("email", email)
    .maybeSingle();
  if (existingError) throw new AppError("internal", "Could not check the email");
  if (existing && existing.status !== "deactivated") {
    throw new AppError("email_in_use", "An administrator already has that email", "email");
  }

  // Create the auth user and send the invite email. The redirect target is validated against the project's
  // allow-list; the actual link the recipient clicks is the token-hash /auth/confirm link in the email
  // template (supabase/templates/invite.html), so an email scanner cannot consume the one-time link.
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name },
    redirectTo: `${appUrl}/accept-invite`,
  });
  if (inviteError || !invited?.user) {
    throw new AppError("internal", "Could not send the invite");
  }
  const newId = invited.user.id;

  // Insert the profile. On any failure, delete the just-created auth user so no orphaned account remains
  // (the contract's rollback). Status is 'invited' until the person activates via complete-invite.
  const { error: profileError } = await admin.from("profiles").insert({
    id: newId,
    email,
    display_name,
    role,
    status: "invited",
    invited_by: caller.userId,
    invited_at: new Date().toISOString(),
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(newId).catch(() => undefined);
    throw new AppError("internal", "Could not create the administrator profile");
  }

  // The change and its event are atomic: if the audit write fails, undo the profile + auth user and fail.
  try {
    await writeEvent(admin, {
      actor: caller.userId,
      action: "admin.invited",
      subjectType: "admin",
      subjectId: newId,
      summary: `${caller.displayName} invited an administrator`,
      details: { role },
      ip,
      requestId,
    });
  } catch {
    await admin.from("profiles").delete().eq("id", newId).catch(() => undefined);
    await admin.auth.admin.deleteUser(newId).catch(() => undefined);
    throw new AppError("internal", "Could not record the invite");
  }

  return { id: newId };
});

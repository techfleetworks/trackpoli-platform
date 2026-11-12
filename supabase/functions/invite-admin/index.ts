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
import { provisionInvitedAdmin } from "../_shared/invite.ts";
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

  // Create the auth user, send the invite email and insert the invited profile. These provisioning steps
  // and their rollback live in _shared/invite.ts, shared with recreate-admin so the two never drift.
  const { id: newId } = await provisionInvitedAdmin(admin, {
    email,
    displayName: display_name,
    role,
    invitedBy: caller.userId,
  });

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

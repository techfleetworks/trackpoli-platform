// recreate-admin: an Administrator Manager recreates an administrator who lost their authenticator (TP1-10,
// P1-13, Q-1-06). MANAGER-only, aal2. The account is deleted and a fresh invite is sent for the same email,
// display name and role, producing a NEW id; the old sessions and two-factor factors go with the old auth
// user. Earlier audit events keep the old name/email snapshot, so the history stays readable (NFR-D1/NFR-S11).
//
// Refused for your own account (cannot_target_self) and for the last active manager (last_manager) — the
// function-level check gives a clean error, and the database delete guard (migration 002) is the race-free
// backstop. The account_deleted event is written BEFORE the irreversible delete (as revoke-invite does), and
// because log_event snapshots only the ACTOR, the deleted person's email/display_name/role are carried in the
// event DETAILS so the subject's identity survives the deletion. If a step fails AFTER the delete, an
// operational event is written holding only the ROLE (never a name or email — NFR-D1 bars personal data from
// the operational log; the account_deleted audit event already holds the full snapshot) so the manager can
// simply invite the person again.
//
// Known limit (ADR-0021): writing account_deleted before the delete means a concurrent change that removes
// the other manager between the function-level check and the delete would leave a spurious account_deleted
// while the guarded delete is refused. The function-level check makes this window very narrow and the DB
// guard still prevents an actual last-manager lockout.

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { writeEvent, reportNonFatal } from "../_shared/events.ts";
import { provisionInvitedAdmin } from "../_shared/invite.ts";
import { AppError, isLastManagerGuard } from "../_shared/errors.ts";

const Body = z.object({ admin_id: z.string().uuid() }).strict();

serve("recreate-admin", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { requireAal2: true });
  if (caller.role !== "admin_manager") {
    throw new AppError("forbidden", "Only an Administrator Manager can recreate an account");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError("validation_failed", "Invalid request", "admin_id");
  const { admin_id } = parsed.data;
  if (admin_id === caller.userId) {
    throw new AppError("cannot_target_self", "You cannot recreate your own account");
  }

  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("id,email,display_name,role,status")
    .eq("id", admin_id)
    .maybeSingle();
  if (readError) throw new AppError("internal", "Could not read the administrator");
  if (!target) throw new AppError("not_found", "That administrator does not exist");

  // Function-level last-manager check for a clean error before any side-effect; the DB delete guard is the
  // race-free backstop below.
  if (target.role === "admin_manager" && target.status === "active") {
    const { count, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin_manager")
      .eq("status", "active")
      .neq("id", admin_id);
    if (countError) throw new AppError("internal", "Could not check the manager count");
    if ((count ?? 0) === 0) {
      throw new AppError("last_manager", "You cannot recreate the last Administrator Manager");
    }
  }

  const snapshot = {
    email: target.email,
    display_name: target.display_name,
    role: target.role as "admin" | "admin_manager",
  };

  // Record the deletion BEFORE the irreversible delete, carrying the subject snapshot so the deleted person's
  // identity survives in the audit trail (log_event snapshots only the actor).
  await writeEvent(admin, {
    actor: caller.userId,
    action: "admin.account_deleted",
    subjectType: "admin",
    subjectId: admin_id,
    summary: `${caller.displayName} deleted an administrator to recreate the account`,
    details: { role: snapshot.role, email: snapshot.email, display_name: snapshot.display_name },
    ip,
    requestId,
  });

  // Delete the profile (guarded) then the auth user. The guard raises last_admin_manager if a concurrent
  // change left this the final active manager between the check above and here.
  const { error: delProfileError } = await admin.from("profiles").delete().eq("id", admin_id);
  if (isLastManagerGuard(delProfileError)) {
    throw new AppError("last_manager", "You cannot recreate the last Administrator Manager");
  }
  if (delProfileError) throw new AppError("internal", "Could not remove the old profile");
  const { error: delUserError } = await admin.auth.admin.deleteUser(admin_id);
  if (delUserError) {
    await reportNonFatal(admin, {
      component: "recreate-admin",
      requestId,
      errorCode: "recreate_delete_user_failed",
      message: `delete auth user failed during recreate (role=${snapshot.role}); account_deleted holds the snapshot`,
      actor: caller.userId,
    });
    throw new AppError("internal", "Could not remove the old account");
  }

  // Re-invite for the same email/name/role, which creates a new id.
  let created: { id: string };
  try {
    created = await provisionInvitedAdmin(admin, {
      email: snapshot.email,
      displayName: snapshot.display_name,
      role: snapshot.role,
      invitedBy: caller.userId,
    });
  } catch {
    await reportNonFatal(admin, {
      component: "recreate-admin",
      requestId,
      errorCode: "recreate_reinvite_failed",
      message: `re-invite failed after delete (role=${snapshot.role}); account_deleted holds the snapshot for a manual invite`,
      actor: caller.userId,
    });
    throw new AppError("internal", "Could not send the new invite");
  }

  // Record the recreation, pointing at the previous id for the audit trail.
  try {
    await writeEvent(admin, {
      actor: caller.userId,
      action: "admin.account_recreated",
      subjectType: "admin",
      subjectId: created.id,
      summary: `${caller.displayName} recreated an administrator account`,
      details: { previous_id: admin_id },
      ip,
      requestId,
    });
  } catch {
    await reportNonFatal(admin, {
      component: "recreate-admin",
      requestId,
      errorCode: "recreate_event_failed",
      message: `account_recreated event failed; the new account exists (role=${snapshot.role})`,
      actor: caller.userId,
    });
    throw new AppError("internal", "Could not record the recreation");
  }

  return { id: created.id, previous_id: admin_id };
});

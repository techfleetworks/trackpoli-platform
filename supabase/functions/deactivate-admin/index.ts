// deactivate-admin: an Administrator Manager deactivates an administrator (TP1-10, P1-13). MANAGER-only, aal2.
// Deactivating yourself is rejected (cannot_target_self), and the last active manager is protected by the
// database guard (migration 002), surfaced here as last_manager.
//
// The authoritative lockout is the profile status: verifyCaller rejects any non-active caller and every RLS
// policy denies a non-active session, so a 'deactivated' row is locked out the instant it is written. The
// auth ban (ban_duration ~100 years) and the session revoke are defence-in-depth on top of that, so both are
// best-effort and reported on failure — never a reason to fail a deactivation whose status change stuck.
// The change and its event are atomic: a failed audit write reverts the status to active.

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { writeEvent, reportNonFatal } from "../_shared/events.ts";
import { revokeSessions } from "../_shared/sessions.ts";
import { AppError, isLastManagerGuard } from "../_shared/errors.ts";

const Body = z
  .object({ admin_id: z.string().uuid(), reason: z.string().trim().max(500).optional() })
  .strict();

const BAN_DURATION = "876000h"; // ~100 years; the auth-level backstop to the status lockout.

serve("deactivate-admin", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { requireAal2: true });
  if (caller.role !== "admin_manager") {
    throw new AppError("forbidden", "Only an Administrator Manager can deactivate an administrator");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError("validation_failed", "Invalid request", parsed.error.issues[0]?.path.join("."));
  }
  const { admin_id, reason } = parsed.data;
  if (admin_id === caller.userId) {
    throw new AppError("cannot_target_self", "You cannot deactivate your own account");
  }

  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("id,status")
    .eq("id", admin_id)
    .maybeSingle();
  if (readError) throw new AppError("internal", "Could not read the administrator");
  if (!target) throw new AppError("not_found", "That administrator does not exist");
  if (target.status !== "active") {
    throw new AppError("conflict", "Only an active administrator can be deactivated");
  }

  // Write the authoritative status change first (guarded against removing the last manager).
  const { error: updateError } = await admin
    .from("profiles")
    .update({ status: "deactivated", deactivated_at: new Date().toISOString(), deactivated_by: caller.userId })
    .eq("id", admin_id);
  if (isLastManagerGuard(updateError)) {
    throw new AppError("last_manager", "You cannot deactivate the last Administrator Manager");
  }
  if (updateError) throw new AppError("internal", "Could not deactivate the administrator");

  // Change + event atomic: on a failed audit write, restore the active status and fail.
  try {
    await writeEvent(admin, {
      actor: caller.userId,
      action: "admin.deactivated",
      subjectType: "admin",
      subjectId: admin_id,
      summary: `${caller.displayName} deactivated an administrator`,
      details: { reason: reason ?? null },
      ip,
      requestId,
    });
  } catch {
    await admin
      .from("profiles")
      .update({ status: "active", deactivated_at: null, deactivated_by: null })
      .eq("id", admin_id)
      .catch(() => undefined);
    throw new AppError("internal", "Could not record the deactivation");
  }

  // Defence-in-depth, best-effort (the status change above already locks the account out via RLS).
  const { error: banError } = await admin.auth.admin.updateUserById(admin_id, { ban_duration: BAN_DURATION });
  if (banError) {
    await reportNonFatal(admin, {
      component: "deactivate-admin",
      requestId,
      errorCode: "ban_failed",
      message: "auth ban could not be applied after deactivation",
      actor: admin_id,
    });
  }
  await revokeSessions(admin, admin_id, { component: "deactivate-admin", requestId });

  return { id: admin_id };
});

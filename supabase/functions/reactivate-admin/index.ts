// reactivate-admin: an Administrator Manager restores a deactivated administrator (TP1-10, P1-13). MANAGER-
// only, aal2. Only a 'deactivated' profile can be reactivated; any other status is a conflict.
//
// The auth ban is removed first (idempotent, and the user cannot obtain a session until it is), then the
// status is set back to 'active' and the deactivation fields are cleared. The change and its event are
// atomic: a failed audit write restores the deactivated status (and re-applies the ban, best-effort) so the
// account is never left half-reactivated. The person then signs in again and enrols two-factor as normal.

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { writeEvent, reportNonFatal } from "../_shared/events.ts";
import { AppError } from "../_shared/errors.ts";

const Body = z.object({ admin_id: z.string().uuid() }).strict();

serve("reactivate-admin", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { requireAal2: true });
  if (caller.role !== "admin_manager") {
    throw new AppError("forbidden", "Only an Administrator Manager can reactivate an administrator");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError("validation_failed", "Invalid request", "admin_id");
  const { admin_id } = parsed.data;

  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("id,status,deactivated_at,deactivated_by")
    .eq("id", admin_id)
    .maybeSingle();
  if (readError) throw new AppError("internal", "Could not read the administrator");
  if (!target) throw new AppError("not_found", "That administrator does not exist");
  if (target.status !== "deactivated") {
    throw new AppError("conflict", "Only a deactivated administrator can be reactivated");
  }

  // Lift the auth ban first. Fatal on failure, and retry-safe: the status is still 'deactivated', so a
  // retried call passes the guard above and the unban is idempotent.
  const { error: unbanError } = await admin.auth.admin.updateUserById(admin_id, { ban_duration: "none" });
  if (unbanError) throw new AppError("internal", "Could not lift the account ban");

  const { error: updateError } = await admin
    .from("profiles")
    .update({ status: "active", deactivated_at: null, deactivated_by: null })
    .eq("id", admin_id);
  if (updateError) throw new AppError("internal", "Could not reactivate the administrator");

  // Change + event atomic: on a failed audit write, restore the deactivated status and the prior fields, and
  // re-apply the ban (best-effort) so the account is not left active without an audit trail.
  try {
    await writeEvent(admin, {
      actor: caller.userId,
      action: "admin.reactivated",
      subjectType: "admin",
      subjectId: admin_id,
      summary: `${caller.displayName} reactivated an administrator`,
      ip,
      requestId,
    });
  } catch {
    await admin
      .from("profiles")
      .update({
        status: "deactivated",
        deactivated_at: target.deactivated_at,
        deactivated_by: target.deactivated_by,
      })
      .eq("id", admin_id)
      .catch(() => undefined);
    await admin.auth.admin.updateUserById(admin_id, { ban_duration: "876000h" }).catch(() => undefined);
    throw new AppError("internal", "Could not record the reactivation");
  }

  return { id: admin_id };
});

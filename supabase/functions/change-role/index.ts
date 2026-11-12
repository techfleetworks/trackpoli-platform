// change-role: an Administrator Manager changes an administrator's role (TP1-10, P1-13). MANAGER-only, aal2.
// The database guard (guard_last_manager, migration 002) refuses to demote the last active manager; that
// Postgres error is mapped to a clean last_manager 409. After the role changes, the target's sessions are
// revoked so their next request mints a token carrying the new app_role claim — the claim is for routing
// only, RLS reads the role live (ADR-0012).
//
// The change and its event are atomic (AGENTS.md): if the audit write fails, the role is put back and the
// call returns internal. The best-effort session revoke runs only after the event is safely recorded.

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { writeEvent } from "../_shared/events.ts";
import { revokeSessions } from "../_shared/sessions.ts";
import { AppError, isLastManagerGuard } from "../_shared/errors.ts";

const Body = z
  .object({ admin_id: z.string().uuid(), role: z.enum(["admin", "admin_manager"]) })
  .strict();

serve("change-role", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { requireAal2: true });
  if (caller.role !== "admin_manager") {
    throw new AppError("forbidden", "Only an Administrator Manager can change a role");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError("validation_failed", "Invalid request", parsed.error.issues[0]?.path.join("."));
  }
  const { admin_id, role } = parsed.data;

  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("id,role,status")
    .eq("id", admin_id)
    .maybeSingle();
  if (readError) throw new AppError("internal", "Could not read the administrator");
  if (!target) throw new AppError("not_found", "That administrator does not exist");
  const from = target.role;
  if (from === role) throw new AppError("conflict", "The administrator already has that role");

  // Apply the change. The last-manager guard fires here if this would demote the final active manager; its
  // Postgres error surfaces as last_manager. (The function-level check is in recreate/deactivate where self
  // is also rejected; here the DB guard alone is the boundary, since a manager may demote a non-last peer.)
  const { error: updateError } = await admin.from("profiles").update({ role }).eq("id", admin_id);
  if (isLastManagerGuard(updateError)) {
    throw new AppError("last_manager", "You cannot remove the last Administrator Manager");
  }
  if (updateError) throw new AppError("internal", "Could not change the role");

  // Change + event atomic: on a failed audit write, put the role back and fail.
  try {
    await writeEvent(admin, {
      actor: caller.userId,
      action: "admin.role_changed",
      subjectType: "admin",
      subjectId: admin_id,
      summary: `${caller.displayName} changed an administrator's role`,
      details: { from, to: role },
      ip,
      requestId,
    });
  } catch {
    await admin.from("profiles").update({ role: from }).eq("id", admin_id).catch(() => undefined);
    throw new AppError("internal", "Could not record the role change");
  }

  await revokeSessions(admin, admin_id, { component: "change-role", requestId });

  return { id: admin_id, from, to: role };
});

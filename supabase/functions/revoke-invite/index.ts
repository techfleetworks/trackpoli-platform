// revoke-invite: an Administrator Manager cancels a pending invitation (TP1-09, P1-08). MANAGER-only, aal2.
// Only a profile still in status 'invited' can be revoked; an active or deactivated target is a conflict.
// It deletes the auth user and the profile row, so the invite link stops working and the address is free to
// invite again.
//
// Ordering: the audit event is written BEFORE the deletes, while the row still exists, because a delete
// cannot be undone if the event write failed (AGENTS.md's atomic change+event, applied to an irreversible
// change — the same shape recreate-admin uses for account_deleted). The profile row is removed first, then
// the auth user; the audit event keeps the actor's name/email snapshot so the history survives the deletion.

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { writeEvent } from "../_shared/events.ts";
import { AppError } from "../_shared/errors.ts";

const Body = z.object({ admin_id: z.string().uuid() }).strict();

serve("revoke-invite", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { requireAal2: true });
  if (caller.role !== "admin_manager") {
    throw new AppError("forbidden", "Only an Administrator Manager can revoke invitations");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError("validation_failed", "Invalid request", "admin_id");
  const { admin_id } = parsed.data;

  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("id,status")
    .eq("id", admin_id)
    .maybeSingle();
  if (readError) throw new AppError("internal", "Could not read the administrator");
  if (!target) throw new AppError("not_found", "That administrator does not exist");
  if (target.status !== "invited") {
    throw new AppError("conflict", "Only a pending invitation can be revoked");
  }

  // Record the revoke before the irreversible deletes (the event keeps its own actor/subject snapshot).
  await writeEvent(admin, {
    actor: caller.userId,
    action: "admin.invite_revoked",
    subjectType: "admin",
    subjectId: admin_id,
    summary: `${caller.displayName} revoked an invitation`,
    ip,
    requestId,
  });

  const { error: profileError } = await admin.from("profiles").delete().eq("id", admin_id);
  if (profileError) throw new AppError("internal", "Could not remove the invitation");
  const { error: userError } = await admin.auth.admin.deleteUser(admin_id);
  if (userError) throw new AppError("internal", "Could not remove the invited account");

  return { ok: true };
});

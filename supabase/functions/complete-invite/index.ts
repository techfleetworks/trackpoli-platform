// complete-invite: the invited administrator activates their own account (TP1-09, P1-08). A POST-
// authentication function that runs at aal1 — it is called from the /accept-invite flow BEFORE two-factor
// enrolment — and with allowInvited, because the caller is by definition still 'invited' (AGENTS.md).
//
// It takes no body. The password (for an email account) or the Google identity (Q-1-23) has already been
// set by the /accept-invite step; this only flips the profile from 'invited' to 'active' and stamps
// activated_at, then writes the invite_accepted audit event. It is idempotent: a second call on an already
// active account is a safe no-op that returns the profile without writing a duplicate event, so a retry or a
// double submit never fails. Terms acceptance is recorded separately by record-terms before this (Q-1-20).

import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { writeEvent } from "../_shared/events.ts";
import { AppError } from "../_shared/errors.ts";

serve("complete-invite", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { allowInvited: true });

  // Idempotent: if they are already active (a retry or double submit), return the profile unchanged and
  // write no event. Only the invited → active transition activates and is audited.
  if (caller.status === "active") {
    const { data: current } = await admin
      .from("profiles")
      .select("id,email,display_name,role,status")
      .eq("id", caller.userId)
      .maybeSingle();
    return { profile: current };
  }

  // Activate only an invited account (the only other status reaching here would be deactivated, which
  // verifyCaller already rejects). The status guard makes the update itself idempotent under a race.
  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({ status: "active", activated_at: new Date().toISOString() })
    .eq("id", caller.userId)
    .eq("status", "invited")
    .select("id,email,display_name,role,status")
    .maybeSingle();
  if (updateError) throw new AppError("internal", "Could not activate the account");
  if (!updated) {
    // The row moved out of 'invited' between verifyCaller and here (a concurrent activation); re-read it.
    const { data: current } = await admin
      .from("profiles")
      .select("id,email,display_name,role,status")
      .eq("id", caller.userId)
      .maybeSingle();
    return { profile: current };
  }

  // The change and its event are atomic: if the audit write fails, roll the account back to invited.
  try {
    await writeEvent(admin, {
      actor: caller.userId,
      action: "admin.invite_accepted",
      subjectType: "admin",
      subjectId: caller.userId,
      summary: `${caller.displayName} accepted their invitation`,
      details: { role: caller.role },
      ip,
      requestId,
    });
  } catch {
    await admin
      .from("profiles")
      .update({ status: "invited", activated_at: null })
      .eq("id", caller.userId)
      .catch(() => undefined);
    throw new AppError("internal", "Could not record the activation");
  }

  return { profile: updated };
});

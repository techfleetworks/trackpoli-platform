// change-email: an Administrator Manager changes an administrator's email (TP1-10, P1-13, Q-1-10/Q-1-24).
// MANAGER-only, aal2. Changing your own account is rejected (cannot_target_self); an address already held by
// a non-deactivated profile is email_in_use.
//
// The auth email is updated first (email_confirm: true — a manager set it, so no re-verification), then the
// profile email; if the profile write fails the auth email is restored so the two stores never diverge. The
// target's sessions are then revoked and any linked Google identity is unlinked, so the person signs in
// again with the new address; their two-factor enrolment is untouched (Q-1-24). The change and its event are
// atomic: a failed audit write rolls both emails back.
//
// PARKED (TP1-12 / P1-18): the email-changed security notice to the OLD and the NEW address is built with the
// shared notices helper in TP1-12 (see the port marked below, ADR-0021 and docs/TODO.md). Until then an email
// change sends no notification — a known, tracked gap.

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { verifyCaller } from "../_shared/auth.ts";
import { writeEvent, reportNonFatal } from "../_shared/events.ts";
import { revokeSessions } from "../_shared/sessions.ts";
import { unlinkProviderIdentity } from "../_shared/identities.ts";
import { AppError } from "../_shared/errors.ts";

const Body = z
  .object({
    admin_id: z.string().uuid(),
    new_email: z.string().email().transform((s) => s.trim().toLowerCase()),
  })
  .strict();

serve("change-email", async ({ req, admin, ip, requestId }) => {
  const caller = await verifyCaller(req, { requireAal2: true });
  if (caller.role !== "admin_manager") {
    throw new AppError("forbidden", "Only an Administrator Manager can change an email");
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError("validation_failed", "Invalid request", parsed.error.issues[0]?.path.join("."));
  }
  const { admin_id, new_email } = parsed.data;
  if (admin_id === caller.userId) {
    throw new AppError("cannot_target_self", "You cannot change your own email here");
  }

  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("id,email,status")
    .eq("id", admin_id)
    .maybeSingle();
  if (readError) throw new AppError("internal", "Could not read the administrator");
  if (!target) throw new AppError("not_found", "That administrator does not exist");
  const oldEmail = target.email;
  if (oldEmail === new_email) {
    throw new AppError("conflict", "That is already this administrator's email");
  }

  // The address must be free among non-deactivated profiles (the target itself is excluded, so changing an
  // unrelated field never trips on the person's own row). The citext unique index is the hard backstop.
  const { data: clash, error: clashError } = await admin
    .from("profiles")
    .select("id,status")
    .eq("email", new_email)
    .neq("id", admin_id)
    .maybeSingle();
  if (clashError) throw new AppError("internal", "Could not check the email");
  if (clash && clash.status !== "deactivated") {
    throw new AppError("email_in_use", "An administrator already has that email", "new_email");
  }

  // Update the auth email first, then the profile. If the profile write fails, restore the auth email.
  const { error: authError } = await admin.auth.admin.updateUserById(admin_id, {
    email: new_email,
    email_confirm: true,
  });
  if (authError) {
    // A DEACTIVATED administrator still owns their auth email (GoTrue enforces a unique auth email), so an
    // address the profile-level check treated as free — the "reusable once deactivated" contract — can still
    // collide here. Map that one case to a clean email_in_use field error rather than an opaque internal
    // (judge-arch LOW-1). The underlying limit (the old auth user must be freed before the address truly
    // reuses) is shared with invite-admin and noted in ADR-0021. Other auth failures stay internal.
    const code = (authError as { code?: string }).code;
    const message = ((authError as { message?: string }).message ?? "").toLowerCase();
    const isEmailClash =
      code === "email_exists" ||
      message.includes("already been registered") ||
      message.includes("already registered") ||
      message.includes("already exists") ||
      message.includes("duplicate");
    if (isEmailClash) {
      throw new AppError("email_in_use", "An administrator already has that email", "new_email");
    }
    throw new AppError("internal", "Could not update the sign-in email");
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ email: new_email })
    .eq("id", admin_id);
  if (profileError) {
    await admin.auth.admin
      .updateUserById(admin_id, { email: oldEmail, email_confirm: true })
      .catch(() => undefined);
    throw new AppError("internal", "Could not update the administrator email");
  }

  // Change + event atomic: on a failed audit write, roll both emails back and fail.
  try {
    await writeEvent(admin, {
      actor: caller.userId,
      action: "admin.email_changed",
      subjectType: "admin",
      subjectId: admin_id,
      summary: `${caller.displayName} changed an administrator's email`,
      details: { from: oldEmail, to: new_email },
      ip,
      requestId,
    });
  } catch {
    await admin.from("profiles").update({ email: oldEmail }).eq("id", admin_id).catch(() => undefined);
    await admin.auth.admin
      .updateUserById(admin_id, { email: oldEmail, email_confirm: true })
      .catch(() => undefined);
    throw new AppError("internal", "Could not record the email change");
  }

  // End the target's sessions so they sign in again with the new address (best-effort, reported).
  await revokeSessions(admin, admin_id, { component: "change-email", requestId });

  // Unlink any Google identity so the old Google account can no longer sign in to this profile (Q-1-24).
  // Best-effort + reported: the email + session changes above are the authoritative effect.
  try {
    await unlinkProviderIdentity(admin, admin_id, "google");
  } catch {
    await reportNonFatal(admin, {
      component: "change-email",
      requestId,
      errorCode: "google_unlink_failed",
      message: "could not unlink the Google identity after an email change",
      actor: admin_id,
    });
  }

  // PARKED (TP1-12 / P1-18): send the email-changed notice to oldEmail and new_email via the shared notices
  // helper. No notification is sent until TP1-12 wires it (ADR-0021, docs/TODO.md).

  return { id: admin_id, from: oldEmail, to: new_email };
});

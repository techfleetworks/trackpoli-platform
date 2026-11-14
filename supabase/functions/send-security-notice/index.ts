// send-security-notice: the TrackPoli server fires this (internal-only) after a password change or a
// two-factor device replacement, to email the account-holder a security alert (TP1-12, P1-18). The
// email-changed notice is NOT handled here — change-email already holds both addresses and sends it inline;
// this function covers the two changes that happen in the Next runtime, which cannot import the Deno notices
// helper (ADR-0023).
//
// Internal-only (assertInternalCall): only the TrackPoli server may trigger it, so it cannot be abused to send
// mail to arbitrary addresses or to probe who has an account. The recipient is ALWAYS resolved from the user
// id the trusted server supplies, never from a body-supplied address. Best-effort by contract: a missing or
// failed transport is reported once and the function still returns ok — the account change already committed
// and is never undone here. The notice carries no link or secret (NFR-P4), built by the shared templates.

import { z } from "npm:zod@4";
import { serve } from "../_shared/serve.ts";
import { assertInternalCall } from "../_shared/auth.ts";
import { AppError } from "../_shared/errors.ts";
import { reportNonFatal } from "../_shared/events.ts";
import { sendSecurityNotice } from "../_shared/noticeTemplates.ts";
import { buildSmtpTransport } from "../_shared/notices.ts";

const Body = z
  .object({
    type: z.enum(["password_changed", "two_factor_replaced"]),
    user_id: z.string().uuid(),
  })
  .strict();

serve("send-security-notice", async ({ req, admin, requestId }) => {
  assertInternalCall(req);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new AppError("validation_failed", "Invalid request");
  const { type, user_id } = parsed.data;

  // Resolve the recipient from the id the server supplied — never a body-supplied address.
  const { data: profile, error } = await admin
    .from("profiles")
    .select("email")
    .eq("id", user_id)
    .maybeSingle();
  if (error) throw new AppError("internal", "Could not read the administrator");
  if (!profile?.email) return { dispatched: false, reason: "no_address" };

  const transport = await buildSmtpTransport();
  if (!transport) {
    // Domain-blocked period (Q-1-21): no SMTP configured yet. Log one operational event and succeed — the
    // password/two-factor change already happened and must not be undone by a notice that cannot be sent.
    await reportNonFatal(admin, {
      component: "send-security-notice",
      requestId,
      errorCode: "security_notice_skipped_unconfigured",
      message: `security notice not sent, SMTP not configured: ${type}`,
      actor: user_id,
    });
    return { dispatched: false, reason: "unconfigured" };
  }

  const { failed } = await sendSecurityNotice(transport, [profile.email], type, new Date());
  if (failed > 0) {
    await reportNonFatal(admin, {
      component: "send-security-notice",
      requestId,
      errorCode: "security_notice_send_failed",
      message: `security notice send failed: ${type}`,
      actor: user_id,
    });
    return { dispatched: false, reason: "send_failed" };
  }
  return { dispatched: true };
});

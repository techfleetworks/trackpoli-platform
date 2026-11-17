import { test, expect } from "@playwright/test";

// Full-stack security-alert-email scenarios (E2E-18, TP1-12 / P1-18, ADR-0023). Gated on E2E_FULL_STACK so the
// credential-free CI run skips it; it needs the local Supabase stack (migrations + the 7-person seed) with the
// edge runtime served. The behaviour is enumerated in features/auth/security-alert-emails.feature.
//
// SCOPE — what the HARNESS can prove vs what it cannot. The password-changed and two-factor-replaced notices
// are sent by the internal-only send-security-notice edge function through an SMTP transport that is INERT
// until the SMTP_* function secrets are set (buildSmtpTransport returns null). During the domain-blocked
// period (Q-1-21) there is no SMTP and nodemailer-under-Deno is not yet proven, so the harness CANNOT assert a
// notice is DELIVERED to a mailbox — that live-delivery check stays with the "enable Porkbun SMTP + test real
// delivery" item in docs/TODO.md. What the harness CAN prove end-to-end, against the real function and runtime,
// is the security contract that does not depend on a configured transport: the internal-only guard (feature
// scenario 3), the recipient being resolved from the server-supplied user id and never a body-supplied address
// (scenario 3), and the best-effort inert path that never fails the caller (scenarios 1-trigger, 4 and 5).

const FUNCTIONS_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const INTERNAL_SECRET = process.env.INTERNAL_CALL_SECRET ?? "";
const NOTICE_URL = `${FUNCTIONS_BASE}/functions/v1/send-security-notice`;

// abe@example.test, a seeded administrator (supabase/seed.sql). The function resolves the recipient from this
// id, so the test never supplies an address.
const ABE_ID = "00000000-0000-4000-8000-0000000000b1";

// The gateway headers a non-browser caller needs to reach the function (verify_jwt is off for this function,
// but Kong still wants the anon apikey). The x-internal-call-secret is the app-layer gate we are exercising.
const gateway = { Authorization: `Bearer ${ANON}`, apikey: ANON, "content-type": "application/json" };

test.describe("E2E-18: security-alert emails (internal-only send-security-notice function)", () => {
  test.skip(!process.env.E2E_FULL_STACK, "requires the full Supabase stack + seed + edge runtime served");
  // Stateful full-stack scenarios are not safely retried against a non-reset stack (see E2E-11); these are
  // idempotent, but keep the suite's no-retry policy consistent.
  test.describe.configure({ retries: 0 });

  test("refuses a call without the internal-call secret, so it cannot send mail or probe who has an account", async ({ request }) => {
    const res = await request.post(NOTICE_URL, {
      headers: gateway, // no x-internal-call-secret
      data: { type: "password_changed", user_id: ABE_ID },
    });
    expect(res.status()).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  test("with the secret, resolves the recipient from the user id and stays inert without SMTP (best-effort)", async ({ request }) => {
    const res = await request.post(NOTICE_URL, {
      headers: { ...gateway, "x-internal-call-secret": INTERNAL_SECRET },
      data: { type: "password_changed", user_id: ABE_ID },
    });
    expect(res.status()).toBe(200);
    // No SMTP configured in the harness -> the notice is skipped, not sent, and the call still succeeds (the
    // account change it follows is never undone). The recipient was looked up from ABE_ID, not from the body.
    expect(await res.json()).toMatchObject({ ok: true, data: { dispatched: false, reason: "unconfigured" } });
  });

  test("rejects a body that carries an address field, so the recipient can never be body-supplied", async ({ request }) => {
    const res = await request.post(NOTICE_URL, {
      headers: { ...gateway, "x-internal-call-secret": INTERNAL_SECRET },
      data: { type: "password_changed", user_id: ABE_ID, email: "attacker@evil.test" }, // extra field -> strict reject
    });
    expect(res.status()).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "validation_failed" } });
  });

  test("rejects an unknown change type (only the two Next-runtime changes are allowed here)", async ({ request }) => {
    const res = await request.post(NOTICE_URL, {
      headers: { ...gateway, "x-internal-call-secret": INTERNAL_SECRET },
      data: { type: "email_changed", user_id: ABE_ID }, // email_changed is sent inline by change-email, not here
    });
    expect(res.status()).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "validation_failed" } });
  });
});

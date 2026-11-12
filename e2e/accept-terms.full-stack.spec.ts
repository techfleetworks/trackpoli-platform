import { test, expect, type Page } from "@playwright/test";

// Full-stack terms & privacy acceptance scenario (E2E-15, Q-1-20, ADR-0019). Gated on E2E_FULL_STACK so the
// credential-free CI run skips it; it needs a local Supabase stack (migrations 001–009 + the 7-person seed,
// in which tom and ivy have NOT accepted the current policies), the app, and Cloudflare Turnstile TEST keys.
// Like the other full-stack specs it WILL need CI iteration before it is promoted to run on every PR; the
// first run's likely adjustments are the sign-in → /terms redirect timing and the seeded unaccepted users.
//
// The terms gate runs at aal1, BEFORE the two-factor code (migration 009, src/features/auth/termsGate.ts):
// a signed-in administrator who has not accepted the current policies is funnelled to /admin/terms before
// enrolment. The screen records the CURRENT versions via the app's own /admin/api/terms route (never
// Supabase directly, ADR-0005), which forwards to the record-terms edge function; the policy_acceptances
// row is the append-only, attributed, versioned consent record (NFR-S12). The RLS terms gate (migration 009)
// is the authorization boundary and is proven at the data layer by supabase/tests/database/60_terms_gate.test.sql;
// this spec exercises the routing + acceptance flow the administrator actually experiences.

const PASSWORD = "LocalOnly-Passw0rd!"; // the seed's local-only sign-in password
const CURRENT_VERSION = "0"; // the seed's placeholder version (Q-1-22); bump when the approved version "1" lands

/** Sign in with email + password. Turnstile uses TEST keys (always pass), so no widget interaction is needed. */
async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  const submit = page.getByRole("button", { name: "Sign in" });
  await expect(submit).toBeEnabled();
  await submit.click();
}

test.describe("E2E-15: terms & privacy acceptance before any other screen or data", () => {
  test.skip(!process.env.E2E_FULL_STACK, "requires the full Supabase stack + seed + Turnstile test keys");

  test("an unaccepted administrator is sent to terms before two-factor, accepts, and continues", async ({ page }) => {
    // tom: an active Administrator Manager who has NOT accepted the current policies (seed).
    await signIn(page, "tom@example.test");

    // The terms gate funnels them here BEFORE the two-factor funnel (aal1, migration 009).
    await expect(page).toHaveURL(/\/admin\/terms/);
    await expect(page.getByRole("heading", { name: "Terms and privacy notice" })).toBeVisible();

    // Both documents are present: the active one as a labelled, focusable scroll region, the other as a tab
    // (universal-accessibility-wcag — each document is a labelled region the keyboard user can read).
    await expect(page.getByRole("region", { name: "Terms of use, version 0" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Privacy notice" })).toBeVisible();

    // The explicit affirmative act: Accept stays DISABLED until the agreement checkbox is checked.
    const accept = page.getByRole("button", { name: "Accept and continue" });
    await expect(accept).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(accept).toBeEnabled();
    await accept.click();

    // Accepted: the server re-gates and they flow ON past terms toward two-factor enrolment (no factor yet),
    // never back to the terms screen.
    await expect(page).toHaveURL(/\/admin\/mfa\/enrol/);
    await expect(page.getByRole("region", { name: /version 0/ })).toHaveCount(0);
  });

  test("declining signs the administrator out and records no acceptance", async ({ page }) => {
    // ivy: an invited Administrator who has NOT accepted — also funnelled to /terms (verifyCaller allowInvited).
    await signIn(page, "ivy@example.test");
    await expect(page).toHaveURL(/\/admin\/terms/);

    await page.getByRole("button", { name: "Decline and sign out" }).click();

    // Their session is ended and they are returned to sign-in; nothing is recorded (the DB-level check that
    // ivy still has no acceptance row belongs to the pgTAP terms-gate suite).
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });

  test("re-submitting the current acceptance succeeds idempotently", async ({ page }) => {
    // abe already accepted version "0" of both documents in the seed; a retry / double-click must still work.
    await signIn(page, "abe@example.test");
    // Settle on the post-sign-in route first (abe has accepted, so the terms gate passes straight to the
    // two-factor funnel) — this guarantees the session cookie is set before the raw API POSTs below fire.
    await expect(page).toHaveURL(/\/admin\/mfa\/enrol/);
    const body = {
      acceptances: [
        { document: "terms", version: CURRENT_VERSION },
        { document: "privacy", version: CURRENT_VERSION },
      ],
    };
    const first = await page.request.post("/admin/api/terms", { data: body });
    expect(first.status()).toBe(200);
    expect(await first.json()).toEqual({ outcome: "accepted" });

    // The unique (admin_id, document, version) constraint records each document exactly once; the repeat call
    // still succeeds (ON CONFLICT DO NOTHING) rather than failing on a duplicate.
    const second = await page.request.post("/admin/api/terms", { data: body });
    expect(second.status()).toBe(200);
    expect(await second.json()).toEqual({ outcome: "accepted" });
  });

  test("accepting a version that is no longer current is rejected as a stale-version conflict", async ({ page }) => {
    await signIn(page, "abe@example.test");
    await expect(page).toHaveURL(/\/admin\/mfa\/enrol/); // settle on the authenticated route before the raw POST

    // Submitting a version that is not the current one (as if the text changed while the user was reading):
    // record-terms returns a 409 conflict and records nothing; the app route maps that to a 200 BUSINESS
    // outcome the screen handles by reloading the current version.
    const stale = await page.request.post("/admin/api/terms", {
      data: {
        acceptances: [
          { document: "terms", version: "9" },
          { document: "privacy", version: "9" },
        ],
      },
    });
    expect(stale.status()).toBe(200);
    expect(await stale.json()).toEqual({ outcome: "stale_version" });
  });
});

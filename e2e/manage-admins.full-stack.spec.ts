import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { createHmac } from "node:crypto";

// Full-stack admin-management scenarios (E2E-09, E2E-10, E2E-17; TP1-10, P1-13, ADR-0021). Gated on
// E2E_FULL_STACK so the credential-free CI run skips it; it needs a local Supabase stack (migrations + the
// 7-person seed + the dedicated E2E fixtures in supabase/seed-e2e.sql + the access-token hook + the
// last-manager guard), the edge runtime served, the mail-catcher that `supabase start` brings up (a recreate
// sends a fresh invite), and the app. Behaviour is enumerated in features/admins/manage-admins.feature.
//
// These drive the real Admin-management list and dialogs as a signed-in Administrator Manager. The acting
// manager and the two targets are DEDICATED people from the E2E-only overlay (ADR-0034), never the shared
// 7-person cast — mia/max/tom/abe/bea are allocated and cross-coupled to other specs, and adding managers to
// the base seed would break the pgTAP cast-count invariants (60_terms_gate, 20_guards). Distinct emails are
// the row selectors so no scenario collides with another person in the one un-reset seeded DB.
//
// Isolation (the established full-stack pattern): serial, retries off, ONE dedicated acting manager enrolled
// ONCE in beforeAll (re-signing in a manager who already has a factor would route to /verify, not /enrol, so
// a per-test re-enrol is not safely repeatable against the un-reset DB — see role-based-access E2E-08/E2E-11).
// Each test targets a DIFFERENT dedicated person, so their order is independent.

const MANAGER = "mgr-manage@example.test"; // dedicated acting manager (seed-e2e.sql): admin_manager, active, terms accepted, no factor
const PASSWORD = "LocalOnly-Passw0rd!"; // matches seed-e2e.sql / seed.sql
const DEACTIVATE_TARGET = "tgt-deactivate@example.test"; // dedicated active Administrator (E2E-09)
const RECREATE_TARGET = "tgt-recreate@example.test"; // dedicated active Administrator (E2E-17)

// ---- TOTP, to complete the acting manager's forced MFA enrolment (adapted from role-based-access.full-stack) ----
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input: string): Buffer {
  const clean = input.replace(/[^A-Z2-7]/gi, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function totp(secret: string): string {
  const step = Math.floor(Date.now() / 1000 / 30);
  const counter = Buffer.alloc(8);
  counter.writeBigInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

// Establish an aal2 Administrator Manager session: sign in with the Turnstile TEST key, then complete the
// forced two-factor enrolment to reach aal2 on /admin (the acting manager has no factor yet).
async function signInAsManager(page: Page): Promise<void> {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(MANAGER);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  const submit = page.getByRole("button", { name: "Sign in" });
  await expect(submit).toBeEnabled({ timeout: 20_000 }); // waits for the Turnstile test token (slow to load under CI)
  await submit.click();

  await expect(page).toHaveURL(/\/admin\/mfa\/enrol/);
  const begin = page.waitForResponse((r) => r.url().includes("/admin/api/mfa/enrol") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Continue" }).click();
  const secret = ((await (await begin).json()) as { secret?: string }).secret as string;
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: /digit code/i }).fill(totp(secret));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await page.getByRole("button", { name: "Go to dashboard" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe.serial("E2E-09/E2E-10/E2E-17: manage administrators", () => {
  test.skip(!process.env.E2E_FULL_STACK, "requires the full Supabase stack + seed + seed-e2e overlay + edge runtime + mail-catcher");
  // One shared acting-manager session, enrolled once: re-enrolling per test is not safely repeatable against
  // the un-reset DB (the factor would already exist). Retries off for the same reason (the established pattern).
  test.describe.configure({ retries: 0 });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await signInAsManager(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("E2E-09: deactivating an administrator ends their access at once", async () => {
    // The manager opens the list and deactivates a dedicated active administrator.
    await page.goto("/admin/admins");
    const row = page.getByRole("row", { name: new RegExp(DEACTIVATE_TARGET, "i") });
    await row.getByRole("button", { name: /Actions for/i }).click();
    await page.getByRole("menuitem", { name: "Deactivate" }).click();
    await page.getByRole("button", { name: "Deactivate" }).click();

    // The list refreshes and the row now reads Deactivated — the authoritative profile-status change (which RLS
    // uses to deny every non-active session the instant it is written) is reflected in the UI.
    await expect(row.getByText("Deactivated")).toBeVisible();

    // The matching "their next request is sent to sign-in and they cannot sign in again" half is proven at the
    // data/auth layer by the lockout pgTAP (supabase/tests/database/50_lockout.test.sql) and the deactivate-admin
    // session revoke; this UI spec asserts the manager-visible outcome.
  });

  test("E2E-10: a manager cannot remove their own access (self-target refused)", async () => {
    // The acting manager opens their OWN row and tries to deactivate themselves. The self action is offered in
    // the menu but the edge function refuses it: cannot_target_self surfaces as an inline dialog error.
    await page.goto("/admin/admins");
    const selfRow = page.getByRole("row", { name: new RegExp(MANAGER, "i") });
    await selfRow.getByRole("button", { name: /Actions for/i }).click();
    await page.getByRole("menuitem", { name: "Deactivate" }).click();
    await page.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText(/your own account/i)).toBeVisible();

    // The companion last-Administrator-Manager demotion guard is NOT exercised at the UI here, by design
    // (skeptical-audit / ADR-0034). The global guard counts ALL active managers, and the shared seed keeps
    // mia/max/tom active, so it can never fire in this un-reset DB without deactivating the shared cast — which
    // other specs depend on. Making the acting manager "the last" is therefore not honestly reachable from the
    // UI without disturbing the cast. The guard is proven race-free at the layer that owns it:
    // supabase/tests/database/20_guards_and_append_only.test.sql (migration 002) asserts a demote, a deactivate,
    // a status move and a delete that would remove the last active manager all throw last_admin_manager, and
    // supabase/tests/race/last_manager_race.sh proves it under concurrency. The @usecase:change-role-last-manager
    // scenario in features/admins/manage-admins.feature carries that behaviour.
  });

  test("E2E-17: recreating a lost-authenticator account issues a fresh invite", async () => {
    // Recreate a dedicated active administrator who lost their authenticator. Confirm by typing their email
    // (the primary button stays disabled until it matches).
    await page.goto("/admin/admins");
    const row = page.getByRole("row", { name: new RegExp(RECREATE_TARGET, "i") });
    await row.getByRole("button", { name: /Actions for/i }).click();
    await page.getByRole("menuitem", { name: "Recreate account" }).click();
    await page.getByLabel("Type their email to confirm").fill(RECREATE_TARGET);
    await page.getByRole("button", { name: "Recreate account" }).click();

    // The list refreshes; the recreated account (same email, new id) is Invited again — a fresh invitation was
    // sent. The old sessions and factors went with the deleted auth user, and the earlier audit events still
    // name the person through the account_deleted snapshot (asserted at the data layer / recreate-admin writes
    // the snapshot BEFORE the delete; manage-admins.feature @usecase:recreate-audit).
    await expect(row.getByText("Invited")).toBeVisible();
  });
});

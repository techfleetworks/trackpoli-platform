import { test, expect, type Locator, type Page, type Response } from "@playwright/test";
import { createHmac } from "node:crypto";

// Full-stack two-factor scenario (E2E-11, ADR-0009). Gated on E2E_FULL_STACK so the credential-free CI run
// skips it; it needs a local Supabase stack (migrations + the 7-person seed), the app, and Cloudflare
// Turnstile TEST keys. Like e2e/password-reset.full-stack.spec.ts it will need CI iteration before it is
// promoted to run on every PR. The TOTP secrets are read straight from the app's own API responses (the
// enrol "begin" and the replace "authorize"), which is more robust than scraping the key off the screen.
//
// A note on TOTP replay: Supabase rejects a code that was already used, and a code is stable for a 30s
// window, so when the same secret is verified twice (sign-in step-up, then as the "current" code in
// replacement) the test waits for a fresh window between uses. That timing is the most likely thing to
// adjust on the first CI run.

const ADMIN = "abe@example.test"; // a seeded administrator with a password and no factor yet
const PASSWORD = "LocalOnly-Passw0rd!"; // the seed's local-only password (supabase/seed.sql)

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

/** RFC 6238 TOTP (SHA-1, 6 digits, 30s step) for the given secret and time step. */
function totp(secret: string, step: number): string {
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

function currentStep(): number {
  return Math.floor(Date.now() / 1000 / 30);
}

/** Produce a code for `secret` that differs from any already used, waiting for the next 30s window if needed. */
async function freshCode(secret: string, used: Set<string>): Promise<string> {
  let code = totp(secret, currentStep());
  while (used.has(code)) {
    await new Promise((r) => setTimeout(r, 2000));
    code = totp(secret, currentStep());
  }
  used.add(code);
  return code;
}

// A programmatic sign-out (page.request.post) broadcasts on the auth channel, which can redirect the still-open
// page to /sign-in and ABORT a racing goto (net::ERR_ABORTED). Retry the navigation a few times so the re-sign-in
// after sign-out is not flaky; a real user signs out via a full navigation, so this is a test-mechanics guard only.
async function gotoSignIn(page: Page): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      // Default waitUntil "load" (not "domcontentloaded"): the Cloudflare Turnstile script loads async, and
      // returning before it is ready left the widget uninitialised ("Cannot find Widget"), so its token never
      // fired and the Sign in button stayed disabled. Waiting for load matches the other full-stack sign-ins.
      await page.goto("/admin/sign-in");
      return;
    } catch (error) {
      const aborted = error instanceof Error && error.message.includes("ERR_ABORTED");
      if (!aborted || attempt >= 4) throw error;
      await page.waitForTimeout(300);
    }
  }
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await gotoSignIn(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const submit = page.getByRole("button", { name: "Sign in" });
  await expect(submit).toBeEnabled({ timeout: 20_000 }); // waits for the Turnstile test token (slow to load under CI)
  await submit.click();
}

// Fill one or more controlled code/credential fields, then wait for their submit button to become
// enabled, re-applying the fills until it does (bounded to 20s). Every admin code screen gates its
// submit button purely on React controlled state (a six-digit regex on the value, client-side only).
// On a freshly loaded page the step-up code field is reached via a full-page redirect after sign-in, so
// React hydrates from scratch, and a Playwright .fill() can land in the gap before the component is
// interactive: its single input event is lost, the value is stranded in the DOM, React's state stays
// empty, and the button never enables, so the following .click() waited out the entire 180s test budget
// (observed on CI runs 44446496358 and 44384450045 — both hung on a disabled "Verify" with a six-digit
// code present). Re-filling once React is live makes the state take, and the bounded enabled-check turns
// a genuinely stuck field into a fast, legible failure instead of a timeout. This does NOT weaken the
// scenario: the enabled gate is client-only (six digits present), the server still verifies the real code
// at the click that follows, and the URL/heading assertions after it are unchanged.
async function fillAndArm(fields: Array<{ field: Locator; value: string }>, submit: Locator): Promise<void> {
  for (const { field } of fields) await expect(field).toBeEditable({ timeout: 20_000 });
  await expect(async () => {
    for (const { field, value } of fields) {
      await field.fill("");
      await field.fill(value);
    }
    await expect(submit).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

async function secretFrom(response: Response): Promise<string> {
  const body = (await response.json()) as { secret?: string; enrol?: { secret?: string } };
  const secret = body.secret ?? body.enrol?.secret;
  expect(secret, "the API response should carry a TOTP secret").toBeTruthy();
  return secret as string;
}

test.describe("E2E-11: two-factor enrolment, step-up, and device replacement", () => {
  test.skip(!process.env.E2E_FULL_STACK, "requires the full Supabase stack + seed + Turnstile test keys");
  // This scenario mutates shared seed state (it enrols abe a factor), and a Playwright retry re-runs against
  // the SAME Supabase stack — not a fresh `db reset` — so on a retry abe already has a factor and the first
  // assertion (forced enrolment) can never hold. A full-stack, stateful flow is not safely retryable, so turn
  // retries off here rather than let a retry fail misleadingly at a different step.
  test.describe.configure({ retries: 0 });

  test("enrol at first sign-in, a code is required next sign-in, then replace the device", async ({ page }) => {
    // The flow verifies the CURRENT device's TOTP three times (enrol, step-up, re-auth). A code is single-use
    // per 30s window, so freshCode() waits for a new window between reuses; across three reuses that waiting
    // can approach the 60s default on its own. Give the whole flow room so a legitimate window wait is not a
    // timeout. freshCode always returns within one 30s window, so this is an upper bound, not a typical run.
    // NB: the earlier flake here was NOT the window waits — it was a .click() hanging on a code-entry button
    // left disabled by a fill-vs-hydration race (see fillAndArm above), which now fails fast rather than
    // burning this whole budget. The budget is kept only as headroom for a worst-case stack of window waits.
    test.setTimeout(180_000);

    const used = new Set<string>();

    // 1) First sign-in forces enrolment before any data route.
    await signIn(page, ADMIN, PASSWORD);
    await expect(page).toHaveURL(/\/admin\/mfa\/enrol/);

    const beginResponse = page.waitForResponse(
      (r) => r.url().includes("/admin/api/mfa/enrol") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Continue" }).click();
    const secret1 = await secretFrom(await beginResponse);

    await expect(page.getByRole("heading", { name: "Scan the QR code" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    const enrolVerify = page.getByRole("button", { name: "Verify and turn on" });
    await fillAndArm([{ field: page.getByRole("textbox", { name: /digit code/i }), value: await freshCode(secret1, used) }], enrolVerify);
    await enrolVerify.click();

    await expect(page.getByRole("heading", { name: "Two-step verification is on" })).toBeVisible();
    await page.getByRole("button", { name: "Go to dashboard" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // 2) Sign out, then sign in again — a code is required (step-up), not a straight pass to the app.
    await page.request.post("/admin/api/sign-out");
    await signIn(page, ADMIN, PASSWORD);
    await expect(page).toHaveURL(/\/admin\/sign-in\/verify/);
    const stepUpVerify = page.getByRole("button", { name: "Verify" });
    await fillAndArm([{ field: page.getByLabel("Verification code"), value: await freshCode(secret1, used) }], stepUpVerify);
    await stepUpVerify.click();
    await expect(page).toHaveURL(/\/admin$/);

    // 3) Replace the device in Security settings: password + current code -> new device -> new code.
    await page.goto("/admin/settings/security");
    await page.getByRole("button", { name: "Replace device" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Get started" }).click(); // the overview/intro step
    // The authorize step gates "Continue" on BOTH the password and the current code being present in
    // React state, so arm them together before authorizing.
    const authorizeContinue = dialog.getByRole("button", { name: "Continue" });
    await fillAndArm(
      [
        { field: dialog.getByLabel("Current password"), value: PASSWORD },
        { field: dialog.getByLabel("Code from your current device"), value: await freshCode(secret1, used) },
      ],
      authorizeContinue,
    );
    const authorizeResponse = page.waitForResponse(
      (r) => r.url().includes("/admin/api/mfa/replace") && r.request().method() === "POST",
    );
    await authorizeContinue.click();
    const secret2 = await secretFrom(await authorizeResponse);

    await expect(dialog.getByRole("heading", { name: "Add your new device" })).toBeVisible();
    await dialog.getByRole("button", { name: "Continue" }).click();
    const completeReplace = dialog.getByRole("button", { name: "Replace device" });
    await fillAndArm([{ field: dialog.getByRole("textbox", { name: /digit code/i }), value: await freshCode(secret2, used) }], completeReplace);
    await completeReplace.click();

    await expect(dialog.getByRole("heading", { name: "Authenticator device replaced" })).toBeVisible();
  });
});

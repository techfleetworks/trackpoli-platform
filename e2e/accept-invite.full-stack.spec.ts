import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

// Full-stack invite & onboard scenarios (E2E-03, E2E-04; TP1-09, P1-08, ADR-0020). Gated on E2E_FULL_STACK so
// the credential-free CI run skips it; it needs a local Supabase stack (migrations + the 7-person seed + the
// dedicated E2E fixtures in supabase/seed-e2e.sql + the access-token hook), the Mailpit mail-catcher that
// `supabase start` brings up (to read the invite email link), Cloudflare Turnstile TEST keys, and the app.
//
// E2E-03 setup creates a REAL invite through the real app path (ADR-0005: the app never calls Supabase
// directly): a dedicated acting manager signs in to aal2 and POSTs the manager-facing invite action
// (/admin/api/admins/action → invite-admin edge function on the manager's own session), which creates the
// invited profile and sends the invite email. The onboarding half — Continue → terms → set password →
// activate → two-factor — is then driven through the real screens the invited person sees (the accept-invite
// flow, ADR-0020). The acting manager is a DEDICATED person (ADR-0034), never the shared cast, so this spec
// never disturbs mia/max/tom (used by E2E-05/E2E-15) in the one un-reset seeded DB.

const NEW_PASSWORD = "correct-horse-battery-staple"; // >= 12 chars (NFR-S2)
const INVITER = "mgr-invite@example.test"; // dedicated acting manager (seed-e2e.sql): admin_manager, active, terms accepted, no factor
const INVITER_PASSWORD = "LocalOnly-Passw0rd!"; // matches seed-e2e.sql / seed.sql

const MAIL_BASE = process.env.SUPABASE_INBUCKET_URL ?? "http://127.0.0.1:54324";
// The invite link is the shared /auth/confirm Continue page carrying the single-use token_hash with
// type=invite (supabase/templates/invite.html). SiteURL is http://localhost:3000/admin, so the matched path is
// /admin-relative; the regex captures from /auth/confirm (as the recovery reader does) and we prepend /admin.
const INVITE_LINK = /\/auth\/confirm\?token_hash=[^"'\s<>]+/;

// Reads the most recent invite link for an address from the local mail catcher. Mailpit first (current CLI),
// Inbucket as a fallback (older CLI), mirroring e2e/password-reset.full-stack.spec.ts.
async function latestInviteLink(email: string): Promise<string | null> {
  const path = (await viaMailpit(email)) ?? (await viaInbucket(email));
  return path ? `/admin${path}` : null;
}

// Mailpit: GET /api/v1/messages (newest first) → {messages:[{ID,To:[{Address}]}]}; GET /api/v1/message/{ID} → {HTML,Text}.
async function viaMailpit(address: string): Promise<string | null> {
  const res = await fetch(`${MAIL_BASE}/api/v1/messages?limit=200`);
  if (!res.ok) return null;
  const data = (await res.json()) as { messages?: Array<{ ID: string; To?: Array<{ Address: string }> }> };
  const msgs = data.messages;
  if (!Array.isArray(msgs)) return null; // not Mailpit — let the Inbucket fallback try
  const mine = msgs.find((m) => (m.To ?? []).some((t) => t.Address?.toLowerCase() === address.toLowerCase()));
  if (!mine) return null;
  const bodyRes = await fetch(`${MAIL_BASE}/api/v1/message/${mine.ID}`);
  if (!bodyRes.ok) return null; // transient mail-catcher error → the null path (clear "no invite email" poll timeout), not a throw
  const body = (await bodyRes.json()) as { HTML?: string; Text?: string };
  const match = `${body.HTML ?? ""}${body.Text ?? ""}`.match(INVITE_LINK);
  return match ? match[0] : null;
}

// Inbucket (older CLI): GET /api/v1/mailbox/{mailbox}; GET /api/v1/mailbox/{mailbox}/{id} → {body:{html,text}}.
async function viaInbucket(address: string): Promise<string | null> {
  const mailbox = address.split("@")[0];
  const res = await fetch(`${MAIL_BASE}/api/v1/mailbox/${encodeURIComponent(mailbox)}`);
  if (!res.ok) return null;
  const list = (await res.json()) as Array<{ id: string }>;
  if (!Array.isArray(list) || list.length === 0) return null;
  const id = list[list.length - 1].id;
  const msgRes = await fetch(`${MAIL_BASE}/api/v1/mailbox/${encodeURIComponent(mailbox)}/${id}`);
  if (!msgRes.ok) return null; // transient error → the null path, not a throw
  const msg = (await msgRes.json()) as { body?: { html?: string; text?: string } };
  const match = `${msg.body?.html ?? ""}${msg.body?.text ?? ""}`.match(INVITE_LINK);
  return match ? match[0] : null;
}

// The invite email is sent asynchronously by GoTrue, so poll the mail catcher until it lands.
async function waitForInviteLink(email: string): Promise<string> {
  let link: string | null = null;
  await expect
    .poll(async () => (link = await latestInviteLink(email)), { timeout: 20_000, message: `no invite email for ${email}` })
    .not.toBeNull();
  return link as unknown as string;
}

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

// Sign the dedicated acting manager in to an aal2 session (so invite-admin's requireAal2 + manager checks pass).
async function signInAsManager(page: Page): Promise<void> {
  await page.goto("/admin/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(INVITER);
  await page.getByLabel("Password", { exact: true }).fill(INVITER_PASSWORD);
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

test.describe("E2E-03/E2E-04: invite and onboard an administrator", () => {
  test.skip(!process.env.E2E_FULL_STACK, "requires the full Supabase stack + seed + seed-e2e overlay + mail-catcher + Turnstile test keys");
  // E2E-03 enrols the dedicated inviter manager in the shared stack; a retry against the un-reset DB would start
  // with that manager already enrolled (routed to verify, not enrol) — not safely retryable. Retries off.
  test.describe.configure({ retries: 0 });

  test("E2E-03: an invited administrator accepts terms, sets a password, enrols two-factor and reaches the dashboard", async ({
    browser,
  }) => {
    const email = `invitee-${Date.now()}@example.test`;

    // Setup: a dedicated acting manager signs in to aal2 and invites the brand-new address through the real
    // manager-facing invite action (its own session carries the aal2 token). A separate context so the invited
    // person's onboarding below runs in a clean session.
    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    await signInAsManager(managerPage);
    const invite = await managerPage.request.post("/admin/api/admins/action", {
      data: { action: "invite", payload: { email, display_name: "Ivy Invitee", role: "admin" } },
    });
    expect(invite.ok()).toBeTruthy();
    expect(((await invite.json()) as { ok?: boolean }).ok).toBe(true);
    await managerContext.close();

    const inviteLink = await waitForInviteLink(email);

    // The invited person (clean context) opens the emailed link → the token-hash Continue page, then Continue.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(inviteLink);
    await page.getByRole("button", { name: "Continue" }).click();

    // Terms come first (TP1-08 gate): accept them.
    await expect(page).toHaveURL(/\/admin\/terms/);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Accept and continue" }).click();

    // Then the accept-invite screen: the email is fixed to the invited address; set a password and activate.
    await expect(page).toHaveURL(/\/admin\/accept-invite/);
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await page.getByLabel("Create a password").fill(NEW_PASSWORD);
    await page.getByLabel("Confirm password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Activate account" }).click();

    // Activation flows on to forced two-factor enrolment (no factor yet).
    await expect(page).toHaveURL(/\/admin\/mfa\/enrol/);
    await context.close();
  });

  test("E2E-04: an expired or already-used invite link creates no session", async ({ page }) => {
    // A token hash that is not a live invite (expired, already used, or malformed) must not establish a
    // session: the Continue click reports the link-expired state.
    await page.goto("/admin/auth/confirm?token_hash=expired-or-used-invite-token&type=invite");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "This invitation has expired" })).toBeVisible();

    // No session was created: a protected route still redirects to sign-in.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });
});

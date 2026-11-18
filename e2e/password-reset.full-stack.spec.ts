import { test, expect, type Page } from "@playwright/test";

// Full-stack password-recovery scenario (E2E-05). Gated on E2E_FULL_STACK so the credential-free CI run
// skips it; it needs a local Supabase stack (migrations + the 7-person seed), the Edge Functions served,
// Cloudflare Turnstile TEST keys, and the local mail catcher (Inbucket/Mailpit, started by `supabase start`)
// to read the recovery email. Like e2e/sign-in.full-stack.spec.ts (E2E-02) it will need CI iteration before
// it is promoted to run on every PR; the mail-catcher API path below is the most likely thing to adjust for
// the installed CLI version.

const MAIL_BASE = process.env.SUPABASE_INBUCKET_URL ?? "http://127.0.0.1:54324";

// Read the local mail catcher for an address. Returns the recovery link in the latest message to that
// address, or null when there is none. The current Supabase CLI ships Mailpit; older ones ship Inbucket,
// whose API differs — so try Mailpit first, then fall back to Inbucket.
const RECOVERY_LINK = /\/auth\/confirm\?token_hash=[^"'\s<>]+/;

async function latestRecoveryLink(address: string): Promise<string | null> {
  return (await viaMailpit(address)) ?? (await viaInbucket(address));
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
  const body = (await (await fetch(`${MAIL_BASE}/api/v1/message/${mine.ID}`)).json()) as { HTML?: string; Text?: string };
  const match = `${body.HTML ?? ""}${body.Text ?? ""}`.match(RECOVERY_LINK);
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
  const msg = (await (await fetch(`${MAIL_BASE}/api/v1/mailbox/${encodeURIComponent(mailbox)}/${id}`)).json()) as {
    body?: { html?: string; text?: string };
  };
  const match = `${msg.body?.html ?? ""}${msg.body?.text ?? ""}`.match(RECOVERY_LINK);
  return match ? match[0] : null;
}

async function requestReset(page: Page, email: string): Promise<void> {
  await page.goto("/admin/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  const submit = page.getByRole("button", { name: "Send reset link" });
  await expect(submit).toBeEnabled({ timeout: 20_000 }); // waits for the Turnstile test token (slow to load under CI)
  await submit.click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
}

test.describe("E2E-05: recover a forgotten password", () => {
  test.skip(!process.env.E2E_FULL_STACK, "requires the full Supabase stack + seed + mail catcher + Turnstile test keys");

  const KNOWN = "mia@example.test"; // a seeded administrator manager (has a password)
  const UNKNOWN = "nobody-unregistered@example.test";

  test("known and unknown emails show identical screens; only the known one receives mail", async ({ page }) => {
    await requestReset(page, UNKNOWN);
    const unknownHeading = await page.getByRole("heading").first().textContent();

    await requestReset(page, KNOWN);
    const knownHeading = await page.getByRole("heading").first().textContent();

    // Identical acknowledgement screen for both — nothing reveals whether the account exists.
    expect(knownHeading).toBe(unknownHeading);

    // ...but only the real account actually receives a recovery email.
    expect(await latestRecoveryLink(UNKNOWN)).toBeNull();
    expect(await latestRecoveryLink(KNOWN)).not.toBeNull();
  });

  test("the reset link works once: it resets the password, then is refused on reuse", async ({ page }) => {
    await requestReset(page, KNOWN);
    const link = await latestRecoveryLink(KNOWN);
    expect(link).not.toBeNull();

    // First use: Continue exchanges the token and reaches the set-new-password screen.
    await page.goto(`/admin${link}`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();

    const newPassword = "a-fresh-admin-passphrase-2026";
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Reset password" }).click();

    // No auto-login: the user is sent to the normal sign-in (ADR-0008).
    await expect(page).toHaveURL(/\/admin\/sign-in/);

    // Second use of the SAME link: the one-time token is already consumed -> expired, and no session.
    await page.goto(`/admin${link}`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  });
});

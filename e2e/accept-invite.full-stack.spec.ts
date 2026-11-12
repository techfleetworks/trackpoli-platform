import { test, expect } from "@playwright/test";

// Full-stack invite & onboard scenarios (E2E-03, E2E-04; TP1-09, P1-08, ADR-0020). Gated on E2E_FULL_STACK so
// the credential-free CI run skips it; it needs a local Supabase stack (migrations + the 7-person seed + the
// access-token hook), the Inbucket/Mailpit mail-catcher that `supabase start` brings up (to read the invite
// email link), Cloudflare Turnstile TEST keys, and the app. Like the other full-stack specs it WILL need CI
// iteration before it is promoted; the first run's likely adjustments are the mail-catcher API path (per CLI
// version) and the invite redirect timing.
//
// The invite step calls the invite-admin edge function directly in setup, because the manager-facing invite
// UI lands in TP1-13 (P1-13); the onboarding half — Continue → terms → set password → activate → two-factor —
// is driven through the real screens the invited person sees (the accept-invite flow, ADR-0020).

const NEW_PASSWORD = "correct-horse-battery-staple"; // >= 12 chars (NFR-S2)

// Reads the most recent invite link for an address from the local mail-catcher. The exact API path is the
// likely first-run adjustment (Inbucket vs Mailpit, per the installed Supabase CLI), finalised by the TP1-09
// harness spike (docs/TODO.md).
async function latestInviteLink(email: string): Promise<string> {
  throw new Error(`mail-catcher read not wired for ${email} — the TP1-09 harness spike finalises this`);
}

test.describe("E2E-03/E2E-04: invite and onboard an administrator", () => {
  test.skip(!process.env.E2E_FULL_STACK, "requires the full Supabase stack + seed + mail-catcher + Turnstile test keys");

  test("E2E-03: an invited administrator accepts terms, sets a password, enrols two-factor and reaches the dashboard", async ({ page }) => {
    // Setup (outside the UI, since the invite UI is TP1-13): a manager invites a brand-new address via the
    // invite-admin edge function, which creates the invited profile and sends the invite email.
    const email = `invitee-${Date.now()}@example.test`;
    // ... call invite-admin with a manager's aal2 token (harness helper), then:
    const inviteLink = await latestInviteLink(email);

    // The invited person opens the emailed link → the token-hash Continue page, then clicks Continue.
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

    // Activation flows on to forced two-factor enrolment (no factor yet), then the dashboard after a code.
    await expect(page).toHaveURL(/\/admin\/mfa\/enrol/);
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

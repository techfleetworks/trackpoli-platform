# TrackPoli — follow-up to-do list

Tracked follow-ups that are **not blockers** for merged work. Each is deferred on purpose, with the
reason it is not done yet and what it needs to be done.

> **Domain (Q-1-21): the production domain is `trackpoli.com`** (decided 2026-11-11). The items below that
> say "needs a domain (Q-1-21)" now have their host — see `docs/setup/tp1-02-credentials.md`. Each still
> needs its service account (Supabase / Vercel / Cloudflare / Google OAuth / Porkbun SMTP / Sentry)
> provisioned too; the domain alone does not close them.

## From TP1-02 (merged 2026-11-06, PR #10)

- [ ] **Apply the branch-protection ruleset.** Run `scripts/apply-ruleset.sh` so the committed ruleset
      (required status checks + 1 required approval) actually enforces on `main`. Until it is applied,
      GitHub does not require a review or the routing gate to merge. **Needs:** a repo admin to run it.

- [ ] **Wire up the full-stack E2E-02 test.** The `e2e (full stack · E2E-02)` CI job is currently
      skipped by design. **Needs:** the 2FA / dashboard tickets to exist first so the end-to-end
      sign-in path can be exercised.

- [ ] **Do a real deploy.** Stand the app up on real infrastructure (staging, then production).
      **Needs:** the service accounts (Supabase, Vercel, Cloudflare, Google OAuth, Cloudflare
      Turnstile, Sentry) and a domain to be in place.

## From TP1-03 (merged 2026-11-06, PR #11)

Unlike the items above, these two are **acceptance criteria for TP1-03** (Deliverable #1 and the
E2E-05 criterion), not optional follow-ups. The code shipped and was merged, but the ticket cannot be
marked closed until both are done. Both are **domain-blocked (Q-1-21)** — they need infrastructure to
be provisioned, not more code.

- [ ] **Set up the sending domain + SMTP and test real delivery.** Configure a sending domain
      (SPF/DKIM/DMARC) and Porkbun SMTP in Supabase Auth, then send a recovery email and confirm it
      lands in a real Gmail **and** a real Outlook inbox (not spam). This is the first feature that
      sends mail, so this provisioning belongs to TP1-03. **Needs:** a domain + the Supabase/Porkbun
      accounts (Q-1-21).

- [ ] **Make E2E-05 pass and promote it off the gate.** The full-stack recovery spec
      (`e2e/password-reset.full-stack.spec.ts`) is written but skipped — gated on `E2E_FULL_STACK`.
      Stand up the local full-stack harness (Supabase stack + Inbucket/Mailpit mail-catcher + the
      7-person seed + edge functions served + Turnstile TEST keys), get the spec green (the
      mail-catcher API path is the likely thing to adjust per CLI version), then enable the job on
      every PR. **Needs:** the harness above; depends on the SMTP/domain item for the real-delivery
      path.

## From TP1-04 (branch `feat/tp1-04-two-factor-protection`)

The two-factor code shipped on the branch, but these two are **acceptance / verification items for
TP1-04** that cannot be completed in code alone — both are **domain-blocked (Q-1-21, E2E-16)**: they need
the Supabase and Google OAuth stack to be provisioned, not more implementation.

- [ ] **Make E2E-11 pass and promote it off the gate.** The full-stack two-factor spec
      (`e2e/two-factor.full-stack.spec.ts`) is written but skipped — gated on `E2E_FULL_STACK`. Stand up
      the local full-stack harness (Supabase stack + the 7-person seed + edge functions served + Turnstile
      TEST keys), get the spec green (the TOTP replay timing between reuses is the likely thing to adjust
      on first run), then enable the `e2e (full stack · … E2E-11)` job on every PR. This is the ticket's
      acceptance criterion ("E2E-11 passes"). **Needs:** the harness above.

- [ ] **Verify the Google device-replacement re-authentication end-to-end.** The Google re-auth round-trip
      (`/auth/reauth/google` → `/auth/reauth/callback`, the identity-match and the HMAC marker) is built and
      unit-tested, but the live OAuth flow cannot be exercised until the Google account and domain exist —
      the same deferral as the Google **sign-in** path (E2E-16). Once the stack is up, run the replacement
      flow for a real Google-only administrator and confirm the "different Google account" and
      "sign-in not completed" branches behave. **Needs:** Google OAuth provisioning + a domain (Q-1-21).

- [ ] **Exercise the break-glass recovery runbook once infra exists.** `docs/runbooks/mfa-device-recovery.md`
      documents how a lost-device administrator is re-created (and the only-manager two-person path). The
      standard path is covered by the app; the break-glass path relies on operator-level Supabase access
      that only exists after provisioning. **Needs:** the Supabase project + accounts (Q-1-21); confirm the
      procedure end-to-end then.

## From TP1-05 (branch `feat/tp1-05-safe-sessions`)

The safe-sessions code shipped, but these are **acceptance / verification / scope items** that cannot be
finished in this ticket's code.

- [ ] **Make E2E-06 and E2E-07 pass and promote them off the gate.** The full-stack spec
      (`e2e/safe-sessions.full-stack.spec.ts`) is written but skipped — gated on `E2E_FULL_STACK`. It needs a
      **dedicated** full-stack CI job with the limits shortened via env
      (`SESSION_IDLE_MS`, `SESSION_WARN_LEAD_MS`, `SESSION_ACTIVITY_PING_MS`) — it cannot share the existing
      `e2e (full stack · E2E-02, E2E-05, E2E-11)` job, because shortening the session limits there would
      expire those other specs mid-run. Stand up the harness, add the job, get the spec green (the idle
      warning timing is the likely thing to adjust first), then enable it on every PR. This is the ticket's
      acceptance criterion ("E2E-06 and E2E-07 pass"). **Needs:** the full-stack harness + the new job.

- [ ] **Set the Supabase access-token (JWT) lifetime to 5 minutes.** Q-1-02 specifies a 5-minute access
      token; that is a Supabase project Auth setting, not application code (`config.ts` records it for the
      client's reasoning only). **Needs:** the Supabase project to exist (Q-1-21); set it in Auth settings.

- [ ] **Build the per-device Active sessions list.** TP1-05 shipped the **bulk** "Sign out other sessions"
      action only. The design (Figma 1396:175539) also shows a per-device list — each session with device,
      location and last-active, individually revocable. That needs a session registry (enumerate
      `auth.sessions` via the admin client), user-agent parsing ("Chrome on Mac"), IP geolocation ("Lagos",
      from Cloudflare), and per-session revoke — none of which exists yet, and it is partly domain-blocked
      (needs the Supabase + Cloudflare stack to test). **Needs:** its own ticket + the stack (Q-1-21).

- [ ] **Make the idle/absolute timeout fail-closed after a grace period (harden the fail-open).** Today a
      deleted/corrupted `tp-activity` cookie reads as absent and the middleware fails open (allows the
      request), so the timeout is bypassable by deleting the cookie at an already-authenticated workstation
      (judge-arch MED-1; documented in ADR-0010 and covered by a @security fail-open scenario). To close it,
      stamp `tp-activity` at sign-in / MFA-completion so "authenticated + aal2 + no activity cookie" can be
      told apart from a legitimate first request, then fail *closed* after a short grace. **Needs:** the
      server-side session registry (same dependency as the per-device list) to distinguish the two states
      safely without risking a lockout.

- [ ] **Confirm the idle/absolute limits behave with a real Cloudflare + Vercel edge.** The middleware
      enforcement and cookie clearing are unit/e2e-tested against the dev server; verify the signed activity
      cookie, the `Clear-Site-Data` header, and the `/session-expired` redirect behave once the app sits
      behind Cloudflare → Vercel with the `/admin/*` never-cache rule (docs/cloudflare-spike.md). **Needs:**
      the Cloudflare + Vercel deploy (Q-1-21).

## From TP1-06 (branch `feat/tp1-06-role-based-access`)

The role-based-access code shipped, but these are **acceptance / verification / scope items** that cannot be
finished in this ticket's code.

- [ ] **Make E2E-08 pass and promote it off the gate.** The full-stack spec
      (`e2e/role-based-access.full-stack.spec.ts`) is written but skipped — gated on `E2E_FULL_STACK`. Stand
      up the harness (Supabase stack with the access-token hook enabled + the 7-person seed + Turnstile TEST
      keys), sign in as a plain Administrator, and confirm `/admins` shows the forbidden screen and
      `/admin/api/admins` returns 403. This is the ticket's acceptance criterion ("E2E-08 passes"). **Needs:**
      the full-stack harness.

- [ ] **Live-verify the authenticated shell (visual + keyboard).** The app shell, side navigation, forbidden
      and not-found screens were built from the exact Figma design context but cannot render without a
      session, so they have not been seen running. Once the stack is up, check the shell against the designs
      and run a keyboard + screen-reader pass (part of the P1-16 a11y audit). **Needs:** the full-stack stack.

- [ ] **Surface the profile `display_name` in the shell.** The side nav and top bar currently show the
      administrator's email as the display name; the real name lives in `profiles.display_name`. Read it
      (own-row RLS allows it) and pass it to the shell. **Needs:** a small session/profile read; no infra.

- [ ] **Wire the "Request access" action on the forbidden screen.** It currently links to Settings as a
      placeholder. Decide and build the real request-access flow (e.g. notify an Administrator manager).
      **Needs:** its own small ticket.

- [ ] **Finish the RequireTerms guard when the terms screen lands.** The guard slot is inert (option A); the
      restrictive RLS enforces terms at the data layer meanwhile. When the terms-acceptance screen + API are
      built, wire RequireTerms to redirect an un-accepted session there and surface acceptance to the client.
      **Needs:** the terms/onboarding ticket.

- [ ] **Handle the `invited` (onboarding) and `deactivated` states properly.** TP1-06 redirects a deactivated
      session to sign-in and lets an invited one through; the real onboarding/invite flow and a deactivated
      screen are their own ticket. **Needs:** the invite/onboarding ticket.

## From TP1-07 (branch `feat/tp1-07-admin-workspace-shell`)

The shell + shared component library shipped and is verified headlessly LOCALLY (E2E-13 keyboard, E2E-14 axe
with 0 serious/critical, Lighthouse LCP 912ms). These are **verification / CI-wiring items**: the acceptance
criteria pass locally but are not all enforced on every PR yet.

- [ ] **Enforce E2E-13 (keyboard) and E2E-14 (axe) in CI.** `e2e/admin-shell.spec.ts` (+ `e2e/global-setup.ts`
      warming the gallery) is written and passes locally, but the `e2e.yml` job only runs
      `e2e/sign-in.spec.ts` + `e2e/forgot-password.spec.ts`, so the shell keyboard + axe acceptance criteria
      are NOT checked on every PR. These specs are **credential-free** (they run against the component gallery
      and the shell demo, no Supabase), so they do NOT need the full-stack harness — add `admin-shell.spec.ts`
      to the `e2e.yml` job and build/start it with `NEXT_PUBLIC_ENABLE_GALLERY=1` so the gallery routes are
      reachable. **Needs:** a one-line addition to the e2e workflow (the job is already browser-capable).

- [ ] **Wire the NFR-P1 Lighthouse check into CI.** `scripts/check-lighthouse.mjs` + `lighthouse.config.json`
      exist and pass locally (LCP 912ms, TBT 16ms, perf 0.98 against the shell demo, budget LCP <= 2500ms),
      but it needs a running app + Chrome, so it is not in CI yet. Add a step to the browser-capable e2e job
      (or a new job) that builds + starts with `NEXT_PUBLIC_ENABLE_GALLERY=1` and runs `npm run check:lighthouse`.
      **Needs:** a browser-capable CI job (the e2e job qualifies). Re-point it at real admin screens as they land.

- [ ] **Live-verify the authenticated shell (real session).** E2E-13/E2E-14 run against the credential-free
      gallery + shell demo (mock `AuthProvider`); the real `(app)` shell behind a session has not been seen
      running. Once the full-stack harness is up, run the keyboard + axe passes against the authenticated
      shell and check it against the Figma frames. **Needs:** the full-stack stack (shared with TP1-06).

- [ ] **Human keyboard + screen-reader a11y audit (NFR-A1).** The conformance record's pass-manual verdicts are
      agent static reviews plus the automated axe scan; the full human assistive-tech audit of the rendered
      shell is scheduled for P1-16. **Needs:** the P1-16 audit.

- [x] **Add dedicated keyboard-event unit tests for the remaining interactive primitives.** Done:
      `otp-field.test.tsx` and `NavItem.test.tsx` now assert each is a native, focusable control kept in the
      tab order (reachable and operable by keyboard), for parity with the dialog/form/snackbar tests.

## From TP1-08 (branch `feat/tp1-08-accept-terms`)

The terms & privacy acceptance screen, the `record-terms` edge function and the live middleware terms gate
shipped (ADR-0019). These are **content / verification / infra** items that cannot be finished in this
ticket's code.

- [ ] **Move the policy prose to a versioned content store and ship the approved version-1 text (Q-1-22).**
      The document *bodies* are version-`0` placeholders in a TS module (`src/features/terms/policies.ts`);
      the *fact* (current version) is correctly owned by Supabase `policy_versions`. Prose-in-code is an
      explicit, labelled placeholder, NOT the pattern (judge-arch LOW-1): before go-live, move the terms and
      privacy text to the versioned content store (Sanity, per the stack) and publish the approved text as
      **version `1`**, which forces re-acceptance with no code change. Consent recorded against placeholder
      text is a build/test artifact, not production-defensible consent. **Needs:** the approved legal text +
      the content store.
- [ ] **Write the E2E-15 full-stack spec, then make it pass off the gate.** `features/terms/accept-terms.feature`
      carries the Gherkin scenarios (invited → /terms, re-consent on a new version, the data gate, the
      stale-version conflict, the immutable record, idempotent re-submit, keyboard a11y, decline), but — unlike
      TP1-03/04/05/06, which each ship a skipped `e2e/*.full-stack.spec.ts` — the executable **Playwright spec
      was NOT written** for TP1-08; it still needs creating as `e2e/accept-terms.full-stack.spec.ts`
      (`E2E_FULL_STACK`-gated/skipped, like the others). Then stand up the full-stack harness (Supabase stack
      with the terms gate + the 7-person seed), drive the accept flow end-to-end, and enable the job on every
      PR. "E2E-15 passes" is the ticket's acceptance criterion, so TP1-08 cannot close until this is green.
      **Needs:** write the spec (doable now, no harness) + the full-stack harness to run it.
- [ ] **Live-verify the authenticated terms flow (visual + keyboard + axe).** The screen was built from the
      Figma frames but cannot render without a session; once the stack is up, check it against the design,
      run an axe scan and a human keyboard + screen-reader pass (part of the P1-16 a11y audit). **Needs:**
      the full-stack stack.
- [ ] **Consider promoting terms acceptance to a token claim (middleware cost).** The gate reads
      `has_accepted_current_policies()` per authenticated gated request (ADR-0019). If this is a latency
      concern at scale, recompute acceptance as an access-token claim (invalidated the instant a new version
      publishes) or a short-lived signed cookie; the RLS boundary does not change. **Needs:** its own ticket
      if the cost proves material.
- [ ] **Honour the acceptance-record erasure exemption in the DSAR ticket.** `policy_acceptances` (incl. the
      email snapshot) is kept as consent evidence beyond account life (NFR-S12, legitimate interest / legal
      obligation). The future data-subject-request / erasure flow must exempt it rather than delete it.
      **Needs:** the DSAR ticket.

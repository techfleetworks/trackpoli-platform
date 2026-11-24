# TrackPoli — follow-up to-do list

Tracked follow-ups that are **not blockers** for merged work. Each is deferred on purpose, with the
reason it is not done yet and what it needs to be done.

> **Domain (Q-1-21): the production domain is `trackpoli.com`** (decided 2026-11-11). The items below that
> say "needs a domain (Q-1-21)" now have their host — see `docs/setup/tp1-02-credentials.md`. Each still
> needs its service account (Supabase / Vercel / Cloudflare / Google OAuth / Porkbun SMTP / Sentry)
> provisioned too; the domain alone does not close them. The per-service, tick-box wiring steps (what to
> set where, in each service's own dashboard) are collected in **`docs/setup/go-live-wiring.md`**.

## From TP1-02 (merged 2026-11-06, PR #10)

- [ ] **Apply the acceptance-gates ruleset (narrow ratchet step), then — later — the full `main-protection`.**
      Per **ADR-0033**, branch protection is split into two separately-appliable rulesets so they can roll out
      independently. The narrow step is ready: `.github/rulesets/e2e-acceptance.json` requires only the three
      proven gates — `e2e (full stack)`, `e2e (full stack · safe sessions)`, `lighthouse (NFR-P1 · admin shell
      LCP)` (the full-stack jobs were renamed to stable, spec-list-free contexts so a required check can't
      silently go blind). **Needs:** a repo admin to run `scripts/apply-ruleset.sh "" e2e-acceptance.json` to
      make E2E-02/05/06/07/08/11/15/18 + NFR-P1 merge-blocking; then verify the contexts match on the next PR.
- [ ] **Apply the broader `main-protection.json` (deferred — needs two prerequisites).** The committed
      `main-protection.json` additionally requires **1 PR approval** and the `check (*)` jobs incl.
      `check (dependencies)`. Applying it now would lock out a solo merger and make the unfixable **picomatch**
      advisory block every merge (`release-deployment-safety`: "do not let a deploy become an outage or a
      lockout"). **Needs:** a second reviewer in the loop, and picomatch resolved (or a documented audit
      exception + ADR), before running `scripts/apply-ruleset.sh` on `main-protection.json`.

- [x] **Wire up the full-stack E2E-02 test.** Done — the full-stack harness (PR #67, merged 2026-11-18)
      runs `e2e/sign-in.full-stack.spec.ts` on every PR and it is green. Not yet a *required* check (see the
      ruleset item above).

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

- [x] **Make E2E-05 pass and promote it off the gate.** Done — merged in the full-stack harness (PR #67,
      2026-11-18): both recovery scenarios run on every PR and are green (reads the recovery link from Mailpit).
      Not yet a *required* check (ruleset item above). The real-delivery path still depends on the SMTP/domain
      item below. Historical detail follows. The full-stack recovery spec
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

- [x] **Make E2E-11 pass and promote it off the gate.** Done — the full-stack harness (PR #67, 2026-11-18)
      runs `e2e/two-factor.full-stack.spec.ts` on every PR and it is green (enrol → step-up → device-replace).
      Not yet a *required* check (ruleset item above). The Google re-auth branch is the separate item below.
      Historical detail follows. The full-stack two-factor spec
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

- [x] **Make E2E-06 and E2E-07 pass and promote them off the gate.** Done — the full-stack harness (PR #67,
      2026-11-18) runs `e2e/safe-sessions.full-stack.spec.ts` in its own dedicated `e2e (full stack · E2E-06,
      E2E-07 safe sessions)` job (with `SESSION_IDLE_MS`/`SESSION_WARN_LEAD_MS`/`SESSION_ACTIVITY_PING_MS`
      shortened via env) and both tests are green. Not yet a *required* check (ruleset item above). Historical
      detail follows. The full-stack spec
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

- [x] **Make E2E-08 pass and promote it off the gate.** Done — the full-stack harness (PR #67, 2026-11-18)
      runs `e2e/role-based-access.full-stack.spec.ts` on every PR and it is green (an Administrator gets the
      forbidden screen and a 403 from the manager API). Not yet a *required* check (ruleset item above).
      Historical detail follows. The full-stack spec
      (`e2e/role-based-access.full-stack.spec.ts`) is written but skipped — gated on `E2E_FULL_STACK`. Stand
      up the harness (Supabase stack with the access-token hook enabled + the 7-person seed + Turnstile TEST
      keys), sign in as a plain Administrator, and confirm `/admins` shows the forbidden screen and
      `/admin/api/admins` returns 403. This is the ticket's acceptance criterion ("E2E-08 passes"). **Needs:**
      the full-stack harness.

- [ ] **Live-verify the authenticated shell (visual + keyboard).** The app shell, side navigation, forbidden
      and not-found screens were built from the exact Figma design context but cannot render without a
      session, so they have not been seen running. Once the stack is up, check the shell against the designs
      and run a keyboard + screen-reader pass (part of the P1-16 a11y audit). **Needs:** the full-stack stack.

- [x] **Surface the profile `display_name` in the shell.** Already shipped in TP1-06/07 — the item's premise
      was stale. `readOwnDisplayName` (`src/lib/supabase/server.ts`) reads `profiles.display_name` by own id
      (own-row RLS, fail-closed to null with a logged warning); `getSessionUser` (`src/features/auth/session.ts`)
      carries it on `AuthUser.display_name`; the `(app)` layout passes `shellDisplayName(user)` — which prefers
      the real name and falls back to the email — into the shell, and `SideNav`/`TopBar` render it
      (`src/features/shell/displayName.ts` + `displayName.test.ts`). Proven by code-reading + unit tests, not a
      live-session E2E (no running stack in CI).

- [x] **Wire the "Request access" action on the forbidden screen.** Done — the action now composes an email in
      the administrator's **own** mail client to the support/manager address (`NEXT_PUBLIC_SUPPORT_EMAIL`, default
      `support@trackpoli.com`), prefilled with the requester and the page they hit
      (`src/features/shell/requestAccess.ts`, wired in `ForbiddenPage.tsx`; `ErrorScreen` now renders a scheme
      href as a plain `<a>`). A deliberately minimal **client-only mailto** — no backend, no stored request, no
      SMTP dependency — chosen in `pattern-selector` over an `access_requests` table for a bounded administrator
      cast. The richer in-app request flow (stored request + manager inbox + audit) is deferred as its own ticket
      (see "Build the in-app access-request flow" below).

- [ ] **Build the in-app access-request flow (deferred from the forbidden-screen mailto).** The 403 "Request
      access" ships as a client-only mailto (above). A fuller flow — a stored `access_requests` record, a
      manager-side inbox to approve/deny, and an audit trail — was deliberately **not** built now: `pattern-selector`
      judged it speculative structure for a bounded, manager-granted administrator cast (no imminent scale or
      second-consumer force), and it would incur a new API trust boundary (`owasp-secure-coding-bdd`) and
      personal-data retention/audit duties (`compliance-data-lifecycle`). Revisit if request volume ever justifies
      it. **Needs:** its own ticket (migration + RLS + API + manager UI + ADR + `@security` BDD).

- [x] **Finish the RequireTerms guard when the terms screen lands.** Done differently — superseded by
      **TP1-08 / [ADR-0019](adr/0019-terms-acceptance-gate-in-middleware-before-two-factor.md)**. Rather than
      wiring a client-side guard, terms enforcement was re-homed to a **middleware** stage (`decideTermsGate`,
      `src/features/auth/termsGate.ts`), between the sign-in guard and RequireMfa, with the restrictive RLS
      (migration 009) as the authorization boundary. The client-side `decideRequireTerms` decision was
      **retired** in TP1-08 (see `src/features/auth/guards/decisions.test.ts`); ADR-0019 deliberately rejected
      the `(app)`-layout-only option and deferred the token-claim optimisation, so no client guard is added.
      The sign-in → `/admin/terms` → acceptance flow is proven end-to-end by E2E-15
      (`e2e/accept-terms.full-stack.spec.ts`).

- [x] **Handle the `invited` (onboarding) and `deactivated` states properly.** Done across two tickets.
      **Invited** shipped in **TP1-09** (ADR-0020): the middleware invite gate (`decideInviteGate`,
      `src/features/auth/inviteGate.ts`) funnels an invited session to `/accept-invite` on live status (after
      terms, before two-factor), and the accept-invite screen activates the account. **Deactivated** shipped in
      this TP1-09 follow-up: instead of the old silent bounce to `/sign-in`, a deactivated session is shown a
      dedicated account-deactivated screen (`src/app/deactivated`, `src/features/auth/AccountDeactivatedPage.tsx`)
      that explains a manager removed their access and destroys the session on mount (best-effort sign-out,
      which also closes the ADR-0021 best-effort-session-kill gap). It reuses the session-expired pattern and is
      a public, standalone pre-app route; the `(app)` layout and the `RequireActive` guard both route deactivated
      there. Routing/UX only — RLS (migration 005) is the boundary (ADR-0012). Proven by unit/component tests
      (`AccountDeactivatedPage.test.tsx`, `wrappers.test.tsx`, `requireMfa.test.ts`), not a live-session E2E
      (no running stack in CI); a live visual + keyboard pass is part of the pending P1-16 audit.

## From TP1-07 (branch `feat/tp1-07-admin-workspace-shell`)

The shell + shared component library shipped and is verified headlessly LOCALLY (E2E-13 keyboard, E2E-14 axe
with 0 serious/critical, Lighthouse LCP 912ms). These are **verification / CI-wiring items**: the acceptance
criteria pass locally but are not all enforced on every PR yet.

- [x] **Enforce E2E-13 (keyboard) and E2E-14 (axe) in CI.** Done: `e2e/admin-shell.spec.ts` was added to the
      credential-free `e2e` job in `.github/workflows/e2e.yml` (run alongside `sign-in.spec.ts` +
      `forgot-password.spec.ts`), with `NEXT_PUBLIC_ENABLE_GALLERY=1` set on the job. The specs run against
      `next dev` (the gallery gate only hides the demo in a production build), so no full-stack harness is
      needed; the shell keyboard + axe acceptance criteria are now checked on every PR. Note: the `e2e`
      workflow is not yet a *required* status check — it becomes merge-blocking once the branch-protection
      ruleset is applied (see the TP1-02 item above).

- [x] **Wire the NFR-P1 Lighthouse check into CI.** Done: a `lighthouse` job in `.github/workflows/e2e.yml`
      builds + starts a production server with `NEXT_PUBLIC_ENABLE_GALLERY=1` (the var is inlined at build
      time, so it is set for both build and start), waits for `/admin/gallery/shell`, and runs
      `npm run check:lighthouse` against the shell demo (budget LCP <= 2500ms, NFR-P1). ubuntu-latest ships
      Google Chrome, which `chrome-launcher` auto-detects. Re-point `lighthouse.config.json` at real admin
      screens as they land; first-run CI iteration (Chrome detection, budget headroom on a shared runner) is
      expected, like the other browser jobs. Not yet a *required* check (same ruleset dependency as above).

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
- [x] **Make the E2E-15 full-stack spec pass and promote it off the gate.** Done — the full-stack harness
      (PR #67, 2026-11-18) runs `e2e/accept-terms.full-stack.spec.ts` on every PR and it is green. Not yet a
      *required* check (ruleset item above). Historical detail follows. Done part: the executable
      Playwright spec is now written — `e2e/accept-terms.full-stack.spec.ts` (`E2E_FULL_STACK`-gated/skipped,
      like TP1-03/04/05/06). It drives the real accept flow from `features/terms/accept-terms.feature`:
      an unaccepted administrator (seed `tom`) is funnelled to `/terms` before two-factor, Accept is gated by
      the agreement checkbox, acceptance routes on into the app; declining (`ivy`) signs out; re-submitting is
      idempotent and a non-current version is rejected as a `stale_version` conflict (both via the
      `/admin/api/terms` route). Remaining: stand up the full-stack harness (Supabase stack with the terms
      gate + the 7-person seed + Turnstile TEST keys), get the spec green (likely first-run adjustment: the
      sign-in → `/terms` redirect timing), and enable the job on every PR. "E2E-15 passes" is the ticket's
      acceptance criterion, so TP1-08 cannot close until this is green. **Needs:** the full-stack harness to
      run it (the data boundary itself is already proven by `supabase/tests/database/60_terms_gate.test.sql`).
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

## From TP1-09 (merged 2026-11-12, PR #35)

The invite flow shipped (ADR-0020): the four edge functions (`invite-admin`, `resend-invite`, `revoke-invite`,
`complete-invite`), the token-hash `/auth/confirm` invite routing, the accept-invite screen/route/service, the
invite email, and the live-status middleware invite gate — all verified by unit tests and two fresh-context
judge-arch reviews. These are **acceptance / verification / infra items** that cannot be finished in code alone;
all are harness- or domain-blocked (Q-1-21). TP1-09 cannot be marked closed until E2E-03/04 are green.

- [x] **Make E2E-03 and E2E-04 pass and promote them off the gate.** Done — **PR #71** (merged 2026-11-18)
      un-fixmed E2E-03: a real invite-creation path in setup + a Mailpit `latestInviteLink` reader + a
      `seed-e2e.sql` overlay (dedicated E2E people, applied only in the full-stack job so the base 7-person
      cast and the pgTAP count invariants stay intact; **ADR-0034**). E2E-03 and E2E-04 are now real and
      blocking in the `e2e (full stack)` job — the TP1-09 acceptance criterion ("E2E-03/04 pass") is met.
      Historical detail follows. The full-stack spec
      (`e2e/accept-invite.full-stack.spec.ts`) is written but skipped — gated on `E2E_FULL_STACK`. It needs the
      full-stack harness (local Supabase stack + the 7-person seed + the Inbucket/Mailpit mail-catcher + Turnstile
      TEST keys), the `latestInviteLink` mail-catcher helper wired (the likely first-run adjustment, per CLI
      version), and a way to call `invite-admin` in setup (a harness helper, or the TP1-13 manager invite UI).
      "E2E-03/04 pass" is the ticket's acceptance criterion. **Needs:** the full-stack harness.
- [x] **Write the stack-dependent edge-function tests (duplicate email, rollback, rate limit, stale terms).**
      Done — **PR #73** (merged 2026-11-19, ADR-0035) built the Deno edge-function test tier
      (`supabase/tests/functions/invite-admins.test.ts`) and a `function-tests` CI job that runs them against the
      served edge runtime + local stack. All four cases are covered: duplicate email, rollback, the resend
      fixed-window rate limit, and the record-terms stale-version 409 conflict. Detection was mutation-proven
      (a planted no-op failed the invite-rollback test). Historical detail follows. The ticket calls for Deno
      function tests against the local stack. The repo has **no Deno test harness** yet
      (the functions are proven via BDD + the harness-gated e2e); these specific cases need the local Supabase
      stack + the edge runtime served. The behaviour is enumerated in `features/admins/invite-admins.feature`.
      **Needs:** a Deno-test harness + the local stack (part of the same deferred full-stack work).
- [ ] **Set up the sending domain + SMTP and test real invite delivery (Q-1-03).** Send a real invite through
      Porkbun custom SMTP and confirm it lands in a real Gmail **and** Outlook inbox (not spam). Shares the SMTP
      provisioning with the TP1-03 recovery-email item. **Needs:** a domain + the Supabase/Porkbun accounts (Q-1-21).
- [ ] **Verify the Google-to-invited link end-to-end (Q-1-23).** An invited administrator continuing with Google
      must use the invited address; after the first sign-in the profile matches on the Google account id. Built
      and unit-reasoned, but the live OAuth round-trip is blocked until Google OAuth is provisioned (same deferral
      as the Google sign-in path, E2E-16). **Needs:** Google OAuth provisioning + a domain (Q-1-21).
- [ ] **Confirm the resend mechanism against the live stack (spike, ADR-0020).** The chosen approach is
      `inviteUserByEmail` again for the unconfirmed user; if the live stack rejects it, fall back (in order) to
      `generateLink` of type `invite`/`magiclink`, then delete-and-recreate — and record the final choice. The
      contract stays unchanged whichever wins. **Needs:** the local full-stack + SMTP (Q-1-21).
- [ ] **Live-verify the accept-invite flow (visual + keyboard + axe).** The screen was built from the sign-in
      frame (shadcn/greyscale) and screenshotted standalone, but the real activation flow behind an invited
      session has not been exercised. Once the stack is up, run the keyboard + axe passes against the live flow
      (part of the P1-16 a11y audit). The approved **version-1 terms text (Q-1-22)** — already tracked in the
      TP1-08 section — is a shared go-live blocker for this flow too. **Needs:** the full-stack stack.

## From TP1-10 (branch `feat/tp1-10-manage-administrators`)

The five admin-management edge functions shipped (ADR-0021): `change-role`, `deactivate-admin`,
`reactivate-admin`, `change-email`, `recreate-admin`, with the shared `provisionInvitedAdmin` routine, the
best-effort-reported side-effect model, and the last-manager guard mapping. These are **acceptance /
verification / forward-dependency items** that cannot be finished in code alone here.

- [x] **Wire the email-changed security notice (parked → TP1-12 / P1-18).** Done in TP1-12 (merged PR #40):
      `change-email` now sends the email-changed notice to the **old and new** address via
      `functions/_shared/noticeTemplates.ts` + `notices.ts`, best-effort and reported. Live delivery is still
      domain-blocked — see the TP1-12 section below.
- [x] **Make E2E-09, E2E-10 and E2E-17 pass and promote them off the gate.** Done — **PR #71** (merged
      2026-11-18): E2E-09 (deactivate ends access), E2E-10 (self-target refusal) and E2E-17 (recreate keeps the
      audit trail + reissues an invite) now drive the real `/admin/admins` list and dialogs as a seeded aal2
      manager, backed by the `seed-e2e.sql` overlay (**ADR-0034**). **E2E-10 is narrowed to the self-target
      refusal (`cannot_target_self`)**: the global last-manager demotion guard can't fire in the shared seed
      (mia/max/tom are all active managers), so it is cited to its data-layer proof — the migration-002 pgTAP
      (`supabase/tests/database/*`) — rather than reproduced flakily in the UI. All three are real and blocking in
      the `e2e (full stack)` job; the TP1-10 acceptance criterion is met. Historical detail follows. The behaviour is enumerated in
      `features/admins/manage-admins.feature`; the full-stack specs need the same harness as TP1-09 (local
      Supabase + seed + edge runtime + mail-catcher), plus a way to drive the manager actions (a harness helper
      or the TP1-10 dialogs). "E2E-09/10/17 pass" is the ticket's acceptance criterion. **Needs:** the full-stack
      harness.
- [x] **Write the stack-dependent function tests (last-manager race, deactivate session-kill, recreate
      snapshot, change-email rollback/unlink).** Done — **PR #73** (merged 2026-11-19, ADR-0035):
      `supabase/tests/functions/manage-admins.test.ts` covers all four against the served edge runtime + local
      stack (last-manager guard, deactivate session-kill, recreate snapshot/audit-trail, change-email
      rollback + Google-identity unlink), run by the `function-tests` CI job. Historical detail follows. These
      need the local Supabase stack + edge runtime; the repo
      still has no Deno test harness. **Needs:** the Deno-test harness + the local stack.
- [ ] **Verify the Google-identity unlink on change-email against a live linked account (Q-1-24).** The unlink
      goes through the GoTrue admin REST (`_shared/identities.ts`) and is unverified because Google OAuth is
      domain-blocked (Q-1-21) and no live stack runs in CI — including the exact identity-id field used by the
      endpoint. It is best-effort and reported today. **Needs:** Google OAuth provisioning + a live stack.
- [ ] **Confirm the last-manager guard end-to-end under concurrency.** The DB guard (migration 002) is the
      race-free boundary and has a pgTAP + race test; confirm `recreate-admin`'s narrow "spurious
      account_deleted" window (ADR-0021) behaves as documented against the live stack. **Needs:** the local stack.
- [ ] **Live a11y + visual verification of the admin-management list and dialogs.** Pending the Admin-management
      Figma frames and the UI build; run the keyboard + axe passes against the real flow (part of the P1-16
      a11y audit). **Needs:** the Figma frames, the UI, and the full-stack stack.

## From TP1-12 (merged 2026-11-14, PR #40)

The security-alert emails shipped (ADR-0023): the three notices (email-changed to the **old and new** address,
password-changed, two-factor-replaced), the pure `functions/_shared/noticeTemplates.ts` templates + fan-out, the
inert-until-configured Porkbun SMTP transport (`functions/_shared/notices.ts`), the internal-only
`send-security-notice` edge function, and the best-effort wiring into `change-email` and the Next
change-password / mfa-replace routes. A skipped/failed send logs one operational event and never undoes the
change. These are **acceptance / verification / design items** that cannot be finished in code alone; the live
send is **domain-blocked (Q-1-21)**. TP1-12 cannot be marked closed until E2E-18 is green.

- [ ] **Enable Porkbun Email Hosting + SMTP secrets + DNS, and test real delivery of the three notices.** The
      transport returns `null` (inert) until `SMTP_HOST/PORT/USER/PASS/FROM` are set as Supabase function
      secrets. Enable Porkbun **Email Hosting** (the free forwarding plan cannot send via SMTP) with a sender
      mailbox (e.g. `security@trackpoli.com`), set the secrets, add **SPF/DKIM/DMARC** on `trackpoli.com`, then
      change an email / password / two-factor device and confirm each notice lands in a real Gmail **and**
      Outlook inbox (not spam), to the right address (email-changed to both). Shares the SMTP/domain
      provisioning with the TP1-03 recovery and TP1-09 invite items; the same SMTP set as Supabase Auth's
      custom SMTP also lights those up. **Needs:** a domain + the Porkbun/Supabase accounts (Q-1-21).
- [x] **Write the full-stack E2E-18 spec and make it pass.** Done — `e2e/security-alert-emails.full-stack.spec.ts`
      was written and merged in the full-stack harness (PR #67, 2026-11-18); it runs on every PR and is green,
      proving the internal-only notice contract (assertInternalCall 403, Zod `.strict()`+enum 422, the
      `{ok:true,data:{dispatched:false,reason:"unconfigured"}}` envelope). Not yet a *required* check (ruleset
      item above). Asserting a notice is actually DELIVERED is the separate SMTP item below. Historical detail
      follows. The behaviour is enumerated in
      `features/auth/security-alert-emails.feature`, but unlike TP1-03/04/05/06/08, **no executable Playwright
      spec exists yet** (`e2e/security-alert-emails.full-stack.spec.ts` is still to be written). Write it
      (`E2E_FULL_STACK`-gated, mail-catcher assertions: one notice per recipient, email-changed to old+new, no
      link/secret in the body), stand up the full-stack harness (local Supabase + the 7-person seed + edge
      runtime served + Inbucket/Mailpit + Turnstile TEST keys), get it green, and enable the job on every PR.
      "E2E-18 passes" is the ticket's acceptance criterion, so TP1-12 cannot close until this is green.
      **Needs:** the full-stack harness + the mail-catcher.
- [ ] **Smoke-test the SMTP send path (nodemailer under the Supabase/Deno edge runtime).** `notices.ts`
      dynamically imports `npm:nodemailer@6.9.16` only when configured; it is asserted from documented npm
      support, **not observed running**. Once the secrets are set, confirm a notice actually sends from the
      deployed edge function (and swap the client if the runtime rejects it — the adapter is isolated so no
      caller changes). **Needs:** the edge runtime deployed + the SMTP secrets (Q-1-21).
- [ ] **Decide plain-text vs designed HTML templates ("Design needed: three email templates").** TP1-12 ships
      **plain-text** notices (NFR-P4-safe, inherently accessible). If branded HTML emails are wanted, they need
      a design and an HTML body added alongside the text part in `noticeTemplates.ts` (keep the text part as the
      fallback). Best done once the domain is live so they can be seen rendering. **Needs:** the email design
      (product decision — plain-text is the Phase-1 default unless changed).

## From the full-stack E2E harness (branch `feat/tp1-harness-fullstack-e2e`)

Standing up the full-stack E2E job (the manual `e2e (full stack …)` job in `.github/workflows/e2e.yml`,
which runs a local Supabase stack + the 7-person seed + the edge functions + Turnstile TEST keys) surfaced
the items below. The **password-recovery routes fix** it found shipped separately (see the PR for this
section). The rest are **work-in-progress on the harness branch**, not yet merged.

- [x] **Password-recovery routes reachable under the middleware.** Done (merged separately):
      `/forgot-password`, `/reset-password`, `/auth/confirm` and their APIs were missing from
      `MFA_PUBLIC_PATHS`, so the live middleware bounced a signed-out visitor (and emailed recovery/invite
      links) to `/sign-in`. A real production-affecting bug, now fixed with a `@security` scenario + unit cases.

- [x] **Fix the seeded `auth.users` for GoTrue sign-in (test-only).** Done — landed with the harness PR #67
      (2026-11-18). The hand-seeded rows left non-nullable GoTrue columns NULL (`confirmation_token` … and
      `created_at`/`updated_at`), so every seeded sign-in failed with "converting NULL to string is unsupported";
      the seed now sets them (plus `auth.identities` rows so accounts classify as password accounts). Production
      is unaffected (real users are created through GoTrue).

- [x] **E2E-05: deliver the recovery email in the local stack.** Resolved — both E2E-05 scenarios pass in CI
      (the earlier template-fetch "connection refused" did not reproduce once the stack came up cleanly). The
      spec reads the recovery link from Mailpit.

- [x] **E2E-11 / real bug: forced two-factor enrolment does not fire.** Root cause was the middleware matcher:
      with `basePath "/admin"` the glob never matched the bare `/admin` root, so the whole gate was bypassed on
      the dashboard. Fixed by adding `"/"` to `config.matcher` (**PR #63**). Two more harness-found bugs were
      banked alongside: password-recovery routes unreachable under the active middleware (**PR #61**) and
      `/api/mfa/replace` 500ing on every call via a duplicate Zod discriminator (**PR #64**). E2E-11 also needed
      a seed fix (email identities, so accounts classify as password) and a bigger timeout + `retries:0`.

- [x] **Merge order to land the harness green.** Done — the four harness-found bug fixes merged (#61 recovery
      routes, #63 root-gating matcher, #64 `/api/mfa/replace` duplicate-discriminator 500, #66 MFA-enrol
      friendly-name) and the harness branch merged as **PR #67** (2026-11-18); a CI flake (`supabase/setup-cli`
      `latest` rate-limit) was fixed by pinning the CLI to `3.2.0`. Alongside, the NFR-P1 `lighthouse` gate was
      stabilised in **PR #68** (ADR-0032): pinned Chrome + `CHROME_PATH`, simulate-throttling with a fixed device
      model, median-of-5, fail-closed, and a mutation-proven discrimination test — budgets unchanged, so the gate
      is deterministic (~210ms) and still catches a real regression. **Remaining to make E2E-02/05/06/07/08/11/15/18
      merge-blocking:** add their job contexts to the required ruleset (see the TP1-02 ruleset item).

- [ ] **E2E-18: live email delivery (still domain-blocked, Q-1-21).** The E2E-18 spec
      (`e2e/security-alert-emails.full-stack.spec.ts`) proves the internal-only notice contract the harness can
      prove without SMTP (guard, recipient-from-id, best-effort inert). Asserting a notice is actually DELIVERED
      needs the Porkbun SMTP secrets + a proven nodemailer-under-Deno path — the same provisioning as the TP1-03
      recovery and TP1-09 invite items above.

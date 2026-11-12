# 0020. Invite & onboard administrators: token-hash /auth/confirm, and a live-status invite gate before two-factor

Date: 2026-11-12

## Status

Accepted

Builds on the terms gate ([0019](0019-terms-acceptance-gate-in-middleware-before-two-factor.md)), the forced
two-factor funnel ([0009](0009-mandatory-two-factor-forced-totp-enrolment-aal2-step-up-gate-and-reauth-gated-device-replacement.md)),
the recovery Continue-page pattern ([0008](0008-password-recovery-enumeration-safe-reset-via-supabase-recovery-tokens.md)),
and the three-layer authorization model ([0012](0012-role-based-access-three-layer-guards-claim-read-role-and-the-authenticated-app-shell.md)).

## Context

TP1-09 (P1-08) delivers invite-only onboarding: an Administrator Manager invites, resends or revokes an
invitation (`invite-admin` / `resend-invite` / `revoke-invite`, manager + aal2), and an invited person
accepts the terms, sets a password or continues with Google, and activates (`complete-invite`), then enrols
two-factor. The edge-function contracts are fixed by the Phase 1 plan, section 4. Three design points were
left open by the plan and had to be decided here.

1. **How does the invite email link reach the person?** The plan's `invite-admin` row sets
   `redirectTo: APP_URL + '/accept-invite'` (the email link lands directly on the screen), but the plan's
   spike (b) and the `/auth/confirm` route both require invite links to be built from the **token hash with a
   confirmation page** "so email scanners cannot use up a link." These conflict.
2. **How does middleware know an administrator is still `invited`, and send them to `/accept-invite`?** The
   cheap signal is the `app_status` token claim (migration 006), but that claim is only re-minted on token
   rotation — so immediately after `complete-invite` flips `invited → active`, the claim still says
   `invited`.
3. **How is an invitation re-sent** to an auth user that already exists but has not confirmed?

## Decision

**Route invite links through the token-hash `/auth/confirm` Continue page, exactly like recovery**, and gate
invited sessions in middleware on the **live** profile status, with RLS as the authorization boundary.

- **Token-hash Continue page (resolves conflict 1).** The invite email (`supabase/templates/invite.html`)
  links to `/auth/confirm?token_hash=…&type=invite`; the token is exchanged only on the explicit Continue
  click (a POST to `/admin/api/auth/confirm`, which already accepts `type=invite`), never on a GET of the
  email link, so a scanner cannot consume the one-time link. `ConfirmPage` then routes `type=invite` to
  `/accept-invite` (recovery still goes to `/reset-password`). The `redirectTo: APP_URL + '/accept-invite'`
  on `inviteUserByEmail` is kept as the contract states — it is the allow-listed fallback destination, not
  the link the recipient clicks — so the contract is honoured and the scanner-safe flow is used.
- **A new middleware "invite" stage, after terms and before two-factor.** `decideInviteGate`
  (`src/features/auth/inviteGate.ts`) is a pure, unit-tested rule like `decideTermsGate`: an authenticated
  session whose status is `invited` is routed to `/accept-invite` on any gated path; `/accept-invite`, its
  API, the terms funnel, sign-out and the activity ping are exempt so the funnel cannot deadlock.
  `/accept-invite` + `/api/accept-invite` are added to `MFA_EXEMPT_PATHS` so RequireMfa does not bounce an
  invited aal1 user off activation. The order is: sign-in → **terms → accept-invite → two-factor** → app.
- **Read the status LIVE, not the token claim (resolves conflict 2).** The gate reads the own-profile status
  from the database (`readInviteStatus`, `src/lib/supabase/server.ts`; readable at aal1 via
  `profiles_select_own`), **only** when the token claim already says `invited`, so an active session never
  pays the read. A just-activated user whose claim is still stale reads `active` live and is **not** bounced
  back — the same live-read discipline the terms gate uses. A read failure fails open (RLS still limits an
  invited session to its own row).
- **`complete-invite` is idempotent at aal1 with `allowInvited`.** The `/accept-invite` route sets the
  password (`auth.updateUser`) then calls `complete-invite`, which flips `invited → active`, stamps
  `activated_at` and writes `admin.invite_accepted`. A second call on an already-active account is a safe
  no-op (no duplicate event), so a retry or double submit never fails. `invite-admin` rolls back the created
  auth user if the profile insert fails, and undoes both if the audit write fails (atomic change + event).

### Spikes (resolves conflict 3; two are infra-verification-deferred, Q-1-21)

- **(a) Porkbun SMTP (Q-1-03):** invite + recovery send through custom SMTP on the project domain. **Design
  accepted; live send is domain-blocked** (no domain/mailbox yet), so delivery to real Gmail/Outlook is
  verified when the domain lands — the send path already fails gracefully meanwhile (operational event, no
  eligibility leak), mirroring `request-password-reset`.
- **(b) Token-hash confirmation links:** **decided and implemented** (above) — the scanner-safe Continue-page
  pattern, reused from recovery.
- **(c) Google-to-invited linking (Q-1-23):** only a verified Google email matching an invited/active profile
  may continue; after the first sign-in the profile is matched on Google's account id. The invited user's
  "Continue with Google" must use the invited address. **Design accepted; the live OAuth round-trip is
  domain-blocked** (same deferral as the Google sign-in path, E2E-16).
- **Resend mechanism:** the chosen approach is `inviteUserByEmail` again for the unconfirmed user; the
  documented fallbacks, in order, are `generateLink` of type `invite`/`magiclink` sent through SMTP, then
  delete-and-recreate. The final choice is confirmed against the live stack (domain-blocked); the contract is
  unchanged whichever wins.

## Options considered

1. **Email link straight to `/accept-invite` (the literal `redirectTo`).** Rejected: a link that establishes
   a session on a bare GET can be consumed by an email security scanner, defeating single-use (spike b). The
   Continue page is the established, safer pattern.
2. **Invite gate reads the `app_status` token claim** (free in middleware). Rejected: the claim is stale for
   up to one token lifetime after activation, which would bounce a just-activated user back to
   `/accept-invite` in a loop. The live read, scoped to invited-claim sessions on gated paths, is correct.
3. **Token-hash Continue page + live-status invite gate before two-factor (chosen).** Consistent with the
   recovery flow and the terms gate, correct ordering, bounded per-request cost (paid only for invited-claim
   sessions).

## Consequences

- **Scanner-safe onboarding, in the right order.** Invite → Continue → terms → set password/Google →
  activate → two-factor → dashboard. Each gate is a pure decision in one ordered middleware chain.
- **Bounded cost.** The live status read is paid only by invited-claim sessions on gated paths — rare and
  short-lived (onboarding only). It is skipped entirely when Supabase env is absent (local dev).
- **RLS remains the boundary.** The invite gate is belt-and-suspenders routing; an invited session has no
  data access beyond its own profile row regardless of routing, so a routing miss is cosmetic.
- **Honest limit: the end-to-end invite flow is not run here.** The four functions, the SMTP send, and the
  Google link are verified against their contracts and unit-tested at the gate/screen level, but E2E-03
  (invite → dashboard) and E2E-04 (expired/used link) are written as a skipped, `E2E_FULL_STACK`-gated
  Playwright spec and pass only once the full-stack harness and the domain exist (Q-1-21). TP1-09 cannot be
  called closed until they are green and the approved version-1 terms text (Q-1-22) ships.

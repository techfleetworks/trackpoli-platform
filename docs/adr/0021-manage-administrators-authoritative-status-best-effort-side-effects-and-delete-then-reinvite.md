# 0021. Manage administrators: authoritative profile status, best-effort side-effects, and delete-then-reinvite

Date: 2026-11-12

## Status

Accepted

Builds on the invite flow ([0020](0020-invite-and-onboard-administrators-token-hash-confirm-and-the-live-status-invite-gate.md)),
the three-layer authorization model ([0012](0012-role-based-access-three-layer-guards-claim-read-role-and-the-authenticated-app-shell.md)),
the forced two-factor funnel ([0009](0009-mandatory-two-factor-forced-totp-enrolment-aal2-step-up-gate-and-reauth-gated-device-replacement.md)),
and the last-manager database guard (migration 002).

## Context

TP1-10 (P1-13) delivers minimal admin management: five privileged edge functions — `change-role`,
`deactivate-admin`, `reactivate-admin`, `change-email`, `recreate-admin`, all Administrator Manager + aal2 —
plus the list and dialogs (the UI lands with the Admin-management Figma frames). The function contracts are
fixed by the Phase 1 plan, section 4. Several design points were left to implementation.

1. **How are the invite steps shared** between `invite-admin` (first invite) and `recreate-admin` (re-invite
   after a lost authenticator), which the plan describes as "run the invite steps for the same email"?
2. **What is the authoritative lockout** when a deactivation's several effects (status change, auth ban,
   session revoke) can each fail independently, and what happens to the call when a non-primary effect fails?
3. **How does `recreate-admin` preserve the deleted person's identity** for the audit trail (Q-1-06, NFR-D1)
   given that `log_event` snapshots only the actor, not the subject?
4. **How is the last active manager protected** across demote, deactivate and delete, and surfaced cleanly?
5. **The email-changed security notice** (plan `change-email`) belongs to TP1-12 / P1-18, which is built
   after this ticket. What ships now?
6. **How is a linked Google identity unlinked** on an email change (Q-1-24) with no admin SDK method for it?

## Decision

**The profile status is the one authoritative control; every other effect is best-effort and reported. The
invite steps are extracted into one shared routine. Recreation is delete-then-reinvite with the subject
snapshot carried in the `account_deleted` event.**

- **Shared provisioning routine (resolves 1).** `_shared/invite.ts` `provisionInvitedAdmin()` holds
  create-auth-user + send-invite + insert-invited-profile + the orphan rollback. `invite-admin` and
  `recreate-admin` both call it; the parts that differ (the email-in-use pre-check, and the audit event with
  its rollback) stay in each caller. One copy of a multi-step workflow instead of two that drift
  (`pattern-selector`: a copied workflow is a boundary-placement force).

- **Authoritative status, best-effort side-effects (resolves 2).** Deactivation writes `status = deactivated`
  first; `verifyCaller` rejects every non-active caller and every RLS policy denies a non-active session, so
  the account is locked out the instant the row is written. The auth ban (`ban_duration` ~100 years) and the
  session revoke are **defence-in-depth**: they are attempted after the status change and its audit event, and
  a failure is written to the operational log as a warning (`reportNonFatal`) rather than failing a
  deactivation that already took effect. The same holds for the session revoke after `change-role` /
  `change-email` and the Google unlink. The change and its event stay atomic (a failed audit write reverts the
  status). This is "recover, retry or report" — never swallow (decisions.md, Error handling).

- **Reactivation lifts the ban first.** `reactivate-admin` removes the ban (fatal on failure, retry-safe
  because the status is still `deactivated`), then sets `active` and clears the deactivation fields; a failed
  audit write restores the deactivated status and re-applies the ban.

- **Delete-then-reinvite with a surviving snapshot (resolves 3).** `recreate-admin` writes `admin.account_deleted`
  **before** the irreversible delete (as `revoke-invite` does). Because `log_event` snapshots only the actor,
  the deleted person's `email`, `display_name` and `role` are carried in the event **details**, so the
  identity survives the deletion (NFR-D1, NFR-S11). It then deletes the profile and auth user and re-invites
  via the shared routine, producing a new id, and writes `admin.account_recreated` with `previous_id`.

- **Last-manager protection (resolves 4).** The database guard (migration 002, `before update or delete`) is
  the race-free boundary across demote, deactivate and delete; its `last_admin_manager` Postgres error is
  mapped to a clean `last_manager` 409 by `isLastManagerGuard`. `deactivate-admin` and `recreate-admin` also
  reject self (`cannot_target_self`) and do a function-level manager-count pre-check for a clean error before
  any side-effect. `change-role` relies on the DB guard alone (a manager may demote a non-last peer).

- **The email notice is parked for TP1-12 (resolves 5).** `change-email` ships the email swap, the auth↔profile
  rollback, the session revoke and the Google unlink now. The email-changed notice to the **old and new**
  address is built with the shared notices helper in TP1-12 / P1-18 (its contract includes a spike on whether
  Supabase's built-in notifications suffice). A clearly-marked port in `change-email` and a `docs/TODO.md`
  entry hold the seam.

- **Google unlink via the GoTrue admin REST (resolves 6).** The supabase-js admin client exposes no
  identity-unlink, so `_shared/identities.ts` detects a linked identity with the established
  `getUserById().identities` pattern and unlinks it through the admin REST endpoint, reading the service
  credentials in `_shared` (the boundary `getAdminClient` already keeps; arch-gate allows the key only under
  `_shared/`).

## Consequences

**Good.** The team can never be locked out (DB guard + self-rejection). A deactivation takes effect even if a
secondary effect fails, and the failure is visible in the operational log, not silent. The deleted person's
history survives (Q-1-06). The invite steps have one owner. `change-email` is complete and testable now
without blocking on the notices ticket.

**Limits (honestly stated).**
- **Parked notice:** until TP1-12, an email change sends no notification to the old address — a known
  defence-in-depth gap for a compromised-manager scenario (tracked in `docs/TODO.md`).
- **Spurious-event race in recreate:** writing `account_deleted` before the delete means a concurrent change
  that removes the other manager between the function-level check and the guarded delete would leave a
  spurious `account_deleted` while the delete is refused as `last_manager`. The window is very narrow and the
  DB guard still prevents any real lockout; the audit log is append-only so the event cannot be edited out.
- **Unverified Google unlink:** the REST unlink path is unverified against a live Google-linked account
  because Google OAuth is domain-blocked (Q-1-21) and no live Supabase stack runs in CI. It is best-effort and
  reported; verification is tracked in `docs/TODO.md`.
- **No Deno unit harness:** the functions are proven by BDD (`features/admins/manage-admins.feature`) and the
  harness-gated full-stack e2e, not Deno unit tests, consistent with the rest of Phase 1.
- **Deactivated-email reuse (judge-arch LOW-1):** the plan calls a deactivated administrator's email reusable,
  but GoTrue keeps that address on the old auth user until it is deleted, so `change-email` (and `invite-admin`)
  cannot actually re-assign it. `change-email` now maps that collision to a clean `email_in_use` field error
  instead of an opaque internal; truly freeing the address requires removing the old auth user (which `recreate`
  does). The limit is shared with `invite-admin`, not introduced here.

## Verification

- `features/admins/manage-admins.feature`: E2E-09 (deactivate ends access), E2E-10 (last manager cannot
  self-remove), E2E-17 (recreate keeps the audit trail), plus the `@security` manager-only, aal2-required,
  IDOR/last-manager, change-email session+Google, and the reliability (rollback, best-effort-reported)
  scenarios.
- `check:architecture`, `check:gherkin`, `check:bdd-tags` pass. The full-stack execution (local Supabase +
  edge runtime + mail-catcher) and the live Google round-trip stay harness/domain-blocked (`docs/TODO.md`).

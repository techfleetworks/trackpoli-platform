# 0022. My profile & security settings: a tabbed Settings shell and self-service account writes

Date: 2026-11-13

## Status

Accepted

Builds on the three-layer authorization model ([0012](0012-role-based-access-three-layer-guards-claim-read-role-and-the-authenticated-app-shell.md)),
the forced two-factor funnel and re-auth-gated device replacement ([0009](0009-mandatory-two-factor-forced-totp-enrolment-aal2-step-up-gate-and-reauth-gated-device-replacement.md)),
the shadcn/ui design system ([0011](0011-adopt-shadcn-ui-radix-tailwind-as-the-component-system.md)),
and the terms-acceptance record (migration 009, [0019](0019-terms-acceptance-gate-in-middleware-before-two-factor.md)).

## Context

TP1-11 (P1-14) delivers *My profile & security settings*: one place where an administrator manages their own
account. Until now Security lived on a standalone `/settings/security` page and `/settings` was a placeholder.
The ticket adds a tabbed Settings page — Profile, Security, Notifications, Preferences, and a manager-only
Workspace rules tab — and two self-service writes (display name, password). Several design points were left to
implementation:

1. **Where do the security cards live**, now that there is a tabbed Settings page, and what happens to the
   existing `/settings/security` URL — which the Google device-replacement re-authentication round-trip returns
   to (`/admin/settings/security?reauth=…`, from the OAuth callback)?
2. **How is a password change made safe** — the current password must be proven before it is replaced, without
   creating an unthrottled password-guessing oracle, and a Google-only account has no password at all?
3. **What is actually functional this phase** for Notifications, Preferences and Workspace rules, whose stores
   and pipelines are later tickets?
4. **How is the accepted-terms history surfaced**, and under what assurance level can it be read?
5. **How is tab visibility decided** for the manager-only Workspace rules tab without turning rendering into an
   authorization decision?

## Decision

**One tabbed Settings page owns the self-service account surface; every write acts on the caller's own account
under RLS; the not-yet-built tabs are rendered as honest, disabled layouts, not wired no-ops.**

- **Tabbed shell; `/settings/security` becomes a redirect (resolves 1).** `SettingsTabs` (a client shell on the
  Radix Tabs primitive) composes the tabs; the Security tab *reuses* the existing `TwoFactorCard` and
  `ActiveSessionsCard` unchanged and adds the new `ChangePasswordCard`. `/settings/security` is kept as a
  redirect to `/settings?tab=security` that **preserves the `reauth` parameter**, so the Google
  device-replacement wizard resumes and existing deep links keep working — without editing the auth routes (the
  OAuth callback still returns to `/admin/settings/security?reauth=…`). The initial tab is resolved on the
  server from `?tab` and clamped to a role-allowed value before it reaches the client.

- **Current-password re-verification over the rate-limited sign-in (resolves 2).** `changePassword` re-verifies
  the current password with `verifyPassword` (a throwaway, non-persistent GoTrue `signInWithPassword`), so it
  inherits GoTrue's native sign-in rate limit — it is **not** an unthrottled oracle — and never persists a
  session. Only then does it call `updateUser({ password })` (which works without a reauth nonce because
  `secure_password_change` is off, exactly as accept-invite and password-reset already rely on); the
  `auth.password_changed` audit event is written by the migration-007 trigger, not by application code. A
  **Google-only** account has no `email` identity, so the change-password card is hidden and the endpoint
  refuses with `not_available`. This mirrors the device-replacement re-authentication (ADR-0009): the session
  alone is never trusted for a sensitive change (OWASP Authentication).

- **Self-service writes act only on the caller's own account (resolves 2, and access).** The display-name and
  change-password endpoints resolve the subject from the session, never from a client-supplied id; the
  display-name write is confined by RLS (`profiles_update_own_name`, migration 005) to the caller's own row and
  the `display_name` column only, and its audit event comes from the migration-007 trigger. RLS is the
  authorization boundary (ADR-0012); the endpoints are thin.

- **Layout-only tabs are disabled, not wired (resolves 3).** Notifications, Preferences and Workspace rules
  render their intended layout with the controls `disabled` and a banner that says nothing is saved yet. A new
  `Switch` primitive (Radix, grayscale tokens) is added for them. Rendering a disabled control rather than a
  live-but-ignored one is deliberate: a control that silently discards a change is worse than one that is
  visibly not-yet-available (usability — prevent the error, do not explain it afterwards). The preference store
  and the notification pipeline are later tickets.

- **Accepted-policies list on the Profile tab, read at aal2 (resolves 4).** The Profile tab reuses the TP1-08
  `AcceptedPolicies` component to show the immutable consent history (compliance-data-lifecycle: a consent
  record is tamper-evident evidence, read-only). The Settings page runs behind RequireMfa at aal2, so the
  signed-in administrator reads their own `policy_acceptances` directly under RLS (`acceptances_select_own`) —
  no service-role client, unlike the aal1 `/terms` screen. This list is a modest compliance-transparency
  addition to the ticket's user story (it is not in the Figma design); it has no security role of its own.

- **Role-aware rendering, never authorization (resolves 5).** The Workspace rules tab is omitted from the
  tablist for a plain administrator. This is rendering only; the data those controls will eventually touch is
  guarded by RLS, so a mis-rendered tab is a cosmetic bug, never an exposure (ADR-0012).

- **The server page owns the reads.** `/settings` reads the profile, the accepted policies and the two-factor
  status on the server and hands plain data to the presentational client shell (decisions.md: UI → data/service,
  never UI → backend). `ProfileTab`/`ChangePasswordCard` reach the server only through `apiFetch` to the thin
  Next API routes (the accept-invite pattern), because `invokeUserFunction` is server-only.

## Consequences

- **Good.** One coherent home for self-service account settings; the two existing security cards move without a
  rewrite; the OAuth re-auth flow and old deep links keep working with no change to the auth routes; a password
  change is throttled and audited; writes cannot cross accounts (RLS); the not-yet-built tabs set honest
  expectations instead of faking functionality.
- **Cost.** `/settings/security` is now an extra redirect hop. The Notifications/Preferences/Workspace controls
  are visible but inert this phase, which must be communicated (the banner does so). Tab state is not synced to
  the URL on click (only the initial tab is URL-driven), a deliberate simplification for Phase 1.
- **Limitation (evidence state: not-assessed).** The end-to-end change-password and display-name journeys, and
  the Google device-replacement resume through the new redirect, are exercised by unit/component tests and the
  BDD scenarios but their full-stack E2E runs remain gated on the full-stack harness (as for TP1-04/05/09). The
  layout-only tabs are intentionally non-functional. A human keyboard + screen-reader audit of the rendered
  Settings page is scheduled for P1-16 (NFR-A1).

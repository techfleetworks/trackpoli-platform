# 0038. A signed `session_started_at` access-token claim closes the absolute-cap cookie-delete bypass

Date: 2026-11-23

## Status

Accepted

Extends [ADR-0010](0010-safe-sessions-idle-and-absolute-timeouts-signed-activity-cookie-cross-tab-sync-and-scoped-sign-out.md)
(safe sessions) and builds on the access-token hook from migration 006 (ADR-0006 grayscale era / the
`app_role`/`app_status` claims).

## Context

TP1-05 enforces the idle (15-min) and absolute (4-hour) session limits server-side from a signed, HttpOnly
`tp-activity` cookie read by the edge middleware (ADR-0010). The cookie carries the session **start** (absolute
cap) and **last activity** (idle cap), HMAC-signed so the browser cannot forge it. Enforcement **fails open**:
an absent or unreadable cookie yields no timeout opinion and the request proceeds, because the RLS `is_aal2()`
gate is the real authorization boundary and a reading gap must never lock an administrator out.

A fresh-context review flagged the obvious hole (judge-arch MED-1): the cookie is the *only* carrier of the
timeout clock, so **deleting `tp-activity` at an already-authenticated workstation removes the deadline
entirely** while the `sb-` session cookies keep working — a session can be extended indefinitely past the
4-hour cap. The idle-fail-closed investigation (saved to project memory) established the split that matters:

- The **idle cap** genuinely needs "last activity", which lives only in the deleted cookie (or a server-side
  session registry that does not exist yet), so it cannot be made fail-closed here without that registry.
- The **absolute cap** needs only the session **start**, which the auth server already owns in
  `auth.sessions.created_at`. Promoting that to a tamper-proof token claim closes the bypass with no new
  table, no registry, and no lockout risk (the claim is always present for an authenticated session).

The alternative considered and rejected was stamping the start into a second signed cookie at sign-in: the
same attacker who deletes `tp-activity` deletes that cookie too, and failing closed on an absent cookie would
lock out every legitimate first request. A cookie-written baseline cannot be the authority; the token can.

## Decision

- **Add a `session_started_at` custom claim to the access-token hook** (`supabase/migrations/012`,
  `public.custom_access_token_hook`). The hook reads `auth.sessions.created_at` for the token's `session_id`
  and stamps it as epoch **seconds** (like `iat`/`exp`), alongside the existing `app_role`/`app_status`. It is
  signed by the auth server (unforgeable), survives a cookie delete, and refreshes with the token. When there
  is no `session_id` or no session row, the claim is **omitted** — routing then falls back to the cookie
  exactly as before.
- **Enforce the absolute cap from the claim when the cookie gives no opinion.** The middleware reads the claim
  via `updateSession` → `readAdminClaims` (as ms) and, when the signed `tp-activity` cookie is absent,
  unreadable, or the secret is missing, applies `evaluateAbsoluteCap(sessionStartedAt, now, absoluteMs)`
  (`src/lib/sessionActivity.ts`): past the hard cap → `absolute-expired` → `/session-expired`; otherwise no
  opinion. The cookie path (`evaluateActivity`) is unchanged and still owns both caps when the cookie is
  present.
- **Keep the idle cap fail-open.** `evaluateAbsoluteCap` never reports idle. With the cookie gone, an over-idle
  but not-yet-absolute session is still allowed — that half waits for the server-side session registry (the
  same dependency as the per-device Active-sessions list).
- This is a **routing/UX + defense-in-depth** change only. RLS `is_aal2()` remains the authorization boundary
  (ADR-0009/0012); the claim does not gate data.

## Consequences

- **The absolute-cap bypass is closed** without the session registry, which was the only Supabase-only half of
  the "make the timeouts fail-closed" item. A deleted cookie now still hits the 4-hour wall.
- **No new attack surface.** The hook already runs per token; it now additionally reads `auth.sessions`
  (owned by `supabase_auth_admin`, which the hook runs as — no new grant). The claim is read-only and carries
  no secret. Migration 012 is a `create or replace function` with the same signature — additive, no table or
  data change, privileges preserved, safe to deploy in any order (an old reader ignores the extra claim).
- **The idle cap is still cookie-dependent** and fails open on a deleted cookie — documented, not accidental.
  Closing it is deferred to the session-registry ticket (see `docs/TODO.md`).
- **Verification.** The hook's claim is proven by pgTAP (`30_functions_and_grants.test.sql`); the fallback
  logic by unit tests (`sessionActivity.test.ts` `evaluateAbsoluteCap`); the behaviour by a `@security`
  Gherkin scenario (`features/auth/safe-sessions.feature`). End-to-end against a live token refresh is covered
  by the full-stack E2E once the stack runs; there is no running stack in CI, so that step is pending.

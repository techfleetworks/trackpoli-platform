# 0019. The terms-acceptance gate runs in middleware, before two-factor, with RLS as the boundary

Date: 2026-11-11

## Status

Accepted

Makes live the terms option left inert in [0012](0012-role-based-access-three-layer-guards-claim-read-role-and-the-authenticated-app-shell.md)
(three-layer authorization). Builds on the data layer landed in TP1-01 (migration 009).

## Context

TP1-08 (P1-17, Q-1-20) requires that every administrator accept the current terms of use and privacy
notice **before any other screen or data**, and accept again whenever either document changes. The data
layer already exists: `policy_versions`, the append-only `policy_acceptances`, the
`has_accepted_current_policies()` signal, and a **restrictive RLS terms gate** that blocks every protected
table from an un-accepted session (migration 009). What was missing is the routing that sends an
un-accepted session to a `/terms` screen, the `record-terms` function, and the screen itself.

Two questions had to be decided:

1. **Where does the routing gate run?** The existing routing gates — session-timeout, sign-in, RequireMfa,
   role — all live in `src/middleware.ts`. RequireMfa and the role gate read **cheap JWT claims** (`aal`,
   `app_role`). Terms acceptance is **not a claim**: it is `has_accepted_current_policies()`, a database
   function, so checking it in middleware costs a DB round-trip per request.
2. **Where does the gate sit in the chain?** Migration 009 deliberately keeps `policy_versions` readable at
   **aal1** with the note "the terms screen comes before the two-factor code", so terms must be enforced
   **before** RequireMfa.

## Decision

Enforce terms as a **new middleware stage, between the sign-in guard and RequireMfa**, as a pure,
unit-tested decision (`decideTermsGate`, `src/features/auth/termsGate.ts`) exactly like `decideMfaGate`. The
real guarantee stays the **restrictive RLS** (migration 009); the gate is belt-and-suspenders routing, so a
routing miss is cosmetic, never a data exposure (ADR-0012).

- **Middleware, not the `(app)` server layout.** Keeping all routing gates in one ordered place (session →
  sign-in → terms → two-factor → role) means the order is read in one file and holds for every path,
  including the two-factor funnel and the API routes, not only `(app)` pages. It matches RequireMfa, so
  there is one mental model for "which screen does this request land on".
- **Before two-factor, at aal1.** `decideTermsGate` runs before the RequireMfa switch, and `/terms` +
  `/api/terms` are added to `MFA_EXEMPT_PATHS` so RequireMfa does not bounce an un-accepted aal1 user off
  the terms screen. The result: sign-in → terms → two-factor → app.
- **Pay the DB read only where it can change routing.** `has_accepted_current_policies()` is read
  (`readTermsAccepted`, `src/lib/supabase/server.ts`) **only** for an authenticated request on a gated path —
  never on the terms funnel, the session-establishment passthrough (OAuth callbacks, the sign-in API, the
  timeout screen), or a public path. A read failure **fails open** (allows), because RLS still blocks the
  data.
- **`record-terms` is a post-authentication edge function** (`verifyCaller` with `allowInvited`, aal1), and
  the `policy_acceptances` row **is** the tamper-evident consent record (no separate audit event). It accepts
  only the current version of every document; a stale version is a `conflict` (409) the screen handles by
  reloading.

### Options considered

1. **Enforce in the `(app)` server layout only.** It would avoid the per-request middleware DB read (the
   layout runs only on `(app)` page renders). Rejected as the sole mechanism: it does not cover the
   two-factor funnel or non-`(app)` routes in one place, and it splits routing logic away from the other
   gates, making the ordering (terms before two-factor) harder to see and keep correct.
2. **Promote terms acceptance to a token claim** (recomputed by the access-token hook, like `app_role`), so
   middleware reads it for free. Rejected **for now**: it adds real complexity (the claim must be
   invalidated and the token refreshed the instant a new version is published, or a user bypasses
   re-consent until their token expires). The simpler DB read, scoped to gated paths, is correct today; the
   claim is a documented future optimisation. The boundary stays RLS either way.
3. **Middleware stage before two-factor, reading the DB only on gated paths, with RLS as the boundary
   (chosen).** Consistent with the existing gate chain, correct ordering, and the per-request cost is
   bounded and documented.

## Consequences

- **Terms come first, and re-consent is automatic.** An un-accepted or out-of-date session is routed to
  `/terms` before the two-factor code and before any data. A new version bumps
  `policy_versions.current_version`, so `has_accepted_current_policies()` returns false and the same gate
  re-fires — no code change (Q-1-22).
- **Operational cost, bounded.** Each authenticated request to a gated path pays one extra RPC. It is not
  paid on the terms funnel, the passthrough paths, or public paths, and the work is skipped entirely when
  Supabase env is absent (local dev). If this becomes a latency concern, option 2 (a claim) or a short-lived
  signed cookie is the next step; the RLS boundary does not change.
- **The consent record is defensible evidence.** Append-only, attributed (email snapshot), versioned,
  timestamped, with the request id and origin IP (NFR-S12). It intentionally **outlives the account** and is
  **exempt from erasure** (kept as proof of consent under legitimate interest / legal obligation); a future
  data-subject-request ticket must honour that exemption. The data map records the lawful basis and
  retention (`check:retention` is green); whether the basis is lawful is for counsel, not the gate.
- **Honest limit: placeholder consent is not production consent.** The documents are version "0"
  placeholders (Q-1-22), clearly labelled on screen. Consent recorded against placeholder text is a
  build/test artifact; go-live needs the approved text shipped as version "1" (which forces re-acceptance)
  before any acceptance is legally meaningful.

# 0025. Security headers and a per-request CSP nonce in middleware, report-only by default

Date: 2026-11-13

## Status

Accepted

The hardening-headers slice of TP1-13 (P1-16). Builds on the single session seam ([0005](0005-admin-auth-cookie-sessions-and-enumeration-resistant-sign-in.md)),
whose `updateSession` is the one place a response is constructed in middleware.

## Context

TP1-13's P1-16 requires all browser security headers **including a per-request CSP nonce**, set in
`src/middleware.ts`. The nonce must be unique per response, so a static `next.config` `headers()` entry cannot
produce it — it has to be generated in middleware. Two things make this delicate:

1. For a nonce-based CSP not to break the app, **Next must put the nonce on its own `<script>` tags**, which it
   does only when it reads the nonce from the request's `Content-Security-Policy` header — so the nonce has to
   ride the **forwarded request headers**, which is exactly what `updateSession` builds (the ADR-0005 seam).
2. The policy **cannot be verified against a running app in CI**: the app is auth-gated and the full stack is
   domain-blocked (Q-1-21), so a wrong directive would only surface after deploy — and a CSP is active the
   moment it ships.

## Decision

**One `securityHeaders` module; the nonce threaded through `updateSession`; and the CSP shipped report-only by
default with an enforce toggle.**

- **Headers in middleware, one source (`src/lib/securityHeaders.ts`).** A pure module builds the nonce, the CSP
  and the static header set (HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Robots-Tag`). Middleware stamps them on **every** response — the pass-through and
  every redirect/early return. The module is pure, so the header set and the policy are unit-tested directly.
- **Nonce through the session seam.** Middleware generates the nonce, sets `x-nonce` and the
  `content-security-policy` request header on a forwarded `Headers`, and passes it to `updateSession`, which now
  takes an optional `requestHeaders` and forwards it on `NextResponse.next({ request: { headers } })` so Next
  nonces its scripts. `updateSession` keeps the cookie refresh correct by re-serialising `request.cookies` into
  that `Headers`' `Cookie` on every `setAll`, so the session-refresh behaviour is unchanged.
- **Report-only by default, enforce by toggle.** The CSP ships as `Content-Security-Policy-Report-Only` unless
  `CSP_ENFORCE` is truthy. Because the policy cannot be validated in CI, report-only lets staging surface every
  violation in the browser console with **zero risk of breaking the first deploy**; once staging is clean the
  team sets `CSP_ENFORCE=1`. The request-header nonce (what Next reads) is always set regardless of mode.
- **Policy shape.** `script-src 'self' 'nonce-…' 'strict-dynamic'` (no `unsafe-inline`, no `unsafe-eval`);
  `style-src 'self' 'unsafe-inline'` — a deliberate, lower-risk relaxation for next/font and inline styles;
  `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; and a
  `connect-src`/`frame-src` allowlist for Supabase, Sentry, Turnstile and Google OAuth (the origins the app
  calls), tuned against the report-only violations on staging.

## Consequences

- **Good.** Defence-in-depth headers on every response; a nonce-based CSP with no `unsafe-inline` for scripts;
  the policy ships safely (report-only) and flips to enforce with one env var after a staging shakeout; one
  tested source of truth for the header set.
- **Cost.** `updateSession` gains an optional parameter (a small widening of the ADR-0005 seam). `style-src`
  keeps `'unsafe-inline'` (styles are a lower-risk sink than scripts). The CSP adds per-request header bytes.
- **Limitation (evidence state: not-assessed).** The header set, the nonce and the policy shape are unit-tested
  now, but the CSP's **correctness against the rendered app is not verified in CI** — it is validated on
  staging in report-only mode (zero console violations) before `CSP_ENFORCE` is set, and the deployed header
  scan + the built-bundle secret scan run there too (`docs/security-checklist.md`, tracked in `docs/TODO.md`).

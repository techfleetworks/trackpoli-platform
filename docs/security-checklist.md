# TrackPoli Admin — security checklist (Phase 1 hardening)

The manual/penetration/accessibility checks for the P1-16 hardening pass (TP1-13). Many controls are enforced
continuously by the repo's skill gates (recorded below with their gate); the rest are manual checks that run
on **staging** once the stack is deployed (Q-1-21) and are recorded in the NFR results doc in PR C. This file
is the reviewed list; a box is ticked only when its evidence exists.

## Continuously enforced by CI gates (evidence: the gate is green on every PR)

- [x] **No architecture drift** — `check:architecture` (arch-gate) + a fresh-context `judge-arch` review per PR.
- [x] **No insecure cookie / `alg:none` JWT** — `check:owasp:lints`.
- [x] **No user-agent sniffing** — `check:no-ua`.
- [x] **Expand/contract-safe migrations** — `check:migrations`.
- [x] **Every PII column declared + retention basis** — `check:pii`, `check:retention`.
- [x] **Design-system only (no raw controls) in changed UI** — `check:design-system`.
- [x] **Alert hygiene (symptom-based, runbook-linked)** — `check:alerts`.
- [x] **Secure-coding scenarios present for auth/security changes** — `check:routing` (auth-change → `@security`).
- [x] **Security headers + CSP policy shape** — `src/lib/securityHeaders.test.ts` asserts the header set, the
      nonce, `frame-ancestors 'none'`, `object-src 'none'`, no `unsafe-eval`, no `unsafe-inline` in `script-src`.

## Browser security headers (set in `src/middleware.ts`, TP1-13 PR B)

- [x] HSTS (2y, includeSubDomains, preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
      `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (deny camera/mic/geo/payment/usb),
      `X-Robots-Tag: noindex` — applied to every response (pass-through and every redirect).
- [x] **Per-request CSP nonce**: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self'
      'unsafe-inline'`, `frame-ancestors 'none'`, with the Supabase/Sentry/Turnstile/Google allowlist.
- [ ] **CSP report-only → enforce on staging.** Ships **report-only by default** (ADR-0025). On staging, load
      every Phase-1 screen, confirm **zero CSP violations** in the browser console, tune the allowlist against
      any reports, then set `CSP_ENFORCE=1` and re-confirm. **Needs:** staging (Q-1-21).
- [ ] **Header scan on the deployed app.** Run an external header scan (e.g. securityheaders.com or `curl -I`)
      against staging and confirm every header above is present with the expected values. **Needs:** staging.

## Manual checks (run on staging — Q-1-21)

- [ ] **Built-bundle secret scan.** Grep the production build output for `SERVICE_ROLE`, `*_SECRET`, SMTP/DSN
      values and any `sb-…` service key; confirm none ship to the client bundle. **Needs:** a production build.
- [ ] **Screen reader + keyboard pass** across every Phase-1 screen (sign-in, recovery, MFA, terms,
      accept-invite, shell, admin management, settings). Part of the NFR-A1 audit. **Needs:** authenticated
      staging.
- [ ] **200% zoom / reflow** at 320px with no loss of content or function (WCAG 1.4.10). **Needs:** staging.
- [ ] **axe scan** on every Phase-1 screen reports 0 serious/critical (E2E-14 covers the gallery/shell today;
      the authenticated screens need a session). **Needs:** authenticated staging.
- [ ] **Session restore drill** — sign out everywhere, idle/absolute timeout, and the break-glass
      last-manager recovery (`docs/runbook.md`) behave end to end. **Needs:** staging.
- [ ] **Email deliverability** — a recovery/invite/security-notice email lands in a real Gmail **and** Outlook
      inbox (not spam), with SPF/DKIM/DMARC passing. **Needs:** Porkbun SMTP + DNS (Q-1-21).
- [ ] **Load test** — the sign-in/recovery path sustains the target concurrency within the NFR-P latency
      budget. **Needs:** staging.
- [ ] **Penetration checklist** — the OWASP ASVS L1 items for an auth-gated admin app; record findings.
      **Needs:** staging.

Each unchecked box is tracked in `docs/TODO.md` (and the NFR results doc in PR C) and is gated on the deployed
stack (Q-1-21), not on more code.

# 0037. Harden the E2E-11 two-factor spec against a fill-vs-hydration race, rather than split it

Date: 2026-11-23

## Status

Accepted

Refines the full-stack acceptance spec `e2e/two-factor.full-stack.spec.ts` (E2E-11, ADR-0009). No change to
the two-factor feature, its Gherkin (`features/auth/two-factor.feature`), the seed, or any production source.

## Context

`e2e (full stack)` on `main` alternates pass/fail on one spec: E2E-11 (enrol → step-up → device replace). It
is not yet a required check (the branch-protection ruleset apply is parked, ADR-0033), but a red acceptance
gate trains the team to ignore failures and will block merges once that ruleset lands, so the flake has to be
removed without weakening what the scenario proves.

**Diagnosis (evidence state: observed — two CI artifacts, identical signature; re-runnable via
`gh run download <id> -n playwright-report-full-stack` → `data/*.md`):**

| run | step reached at timeout | code field | gate button | error |
|-----|-------------------------|------------|-------------|-------|
| 44446496358 | sign-in step-up (`/admin/sign-in/verify`) | `"955238"` (6 digits present) | **"Verify" disabled** | `Test timeout of 180000ms exceeded` |
| 44384450045 | sign-in step-up (`/admin/sign-in/verify`) | `"777403"` (6 digits present) | **"Verify" disabled** | `Test timeout of 180000ms exceeded` |

Every admin code screen gates its submit button purely on React controlled state, client-side only:
`MfaVerifyPage.tsx` uses `canSubmit = !submitting && /^\d{6}$/.test(code)`, `MfaEnrolPage.tsx:253`
mirrors it, and `settings/security/TwoFactorCard.tsx` gates authorize/complete the same way. Playwright's
`.fill()` sets the DOM value and fires one `input` event. The step-up code field is reached via a full
`window.location` redirect after sign-in, so React hydrates from scratch; on a slow shared runner the fill
can land in the gap before the component is interactive, the input event is lost, the value sits stranded in
the DOM, React's `code` state stays `""`, the button never enables, and `.click()` on a disabled button —
which has no per-action timeout and inherits the 180s test budget — burns the whole budget. Step-up is the
most frequent failure point because its field is the one immediately after a full-page load; enrol
(intermediate client clicks) and the replace dialog (opened client-side, React already live) are lower-risk,
which is why an earlier run failed in device-replace but the two most recent fail at step-up: one race,
different step, flaky 17/18.

This is **not** the TOTP window-waiting the spec's own comments anticipated. `freshCode()` waits at most one
30s window on a same-window reuse; three reuses ≈ 90s worst case plus interactions, nowhere near 180s on its
own. The 180s was the hung click, not the waiting.

A hard constraint rules out faking time: the TOTP codes are verified server-side by Supabase against real
wall-clock, and Playwright `page.clock` moves only the browser clock, so the fix must reduce real waiting or
unstick the flow — never fake the clock or loosen an assertion.

## Decision

Add a `fillAndArm(fields, submitButton)` helper to the spec and route all four code/credential entry sites
through it. It fills each field, then asserts the gate button is enabled inside Playwright's
`expect(async () => { … }).toPass({ timeout: 20_000 })`, so a fill lost to the hydration gap is re-applied
once React is interactive, and a field that genuinely never arms fails fast (~20s, with a legible message)
instead of hanging out the 180s budget. `retries: 0` and the serial full-stack model are kept.

We **reject** the alternative of splitting E2E-11 into independent per-user seed-overlay tests (ADR-0034
pattern) to cut same-secret TOTP reuses. The evidence shows the flake is the fill-vs-hydration race, not
same-secret reuse or window-waiting, so splitting would add seed users, a larger surface, and cross-test
state for a cause the artifacts do not support — complexity without a matching failure. If a future run shows
a genuine window-wait budget problem, that split is the right lever then; it is not now.

The fix does not weaken the scenario. The gate button's enabled state is client-only (six digits present); it
does not depend on server validation. The server still verifies the real TOTP at the click that follows, and
the forced-enrolment, step-up-required (`toHaveURL(/\/admin$/)` only after a server-verified code), and
device-replaced assertions are unchanged. A planted-defect CI run (feeding a wrong step-up code) is recorded
on the PR to prove the spec still fails when the real behaviour breaks.

## Consequences

- E2E-11 should be reliably green on the full-stack job, proven across repeated CI runs (the one thing not
  reproducible locally — no Docker on the dev machine — so CI is the evidence).
- A legitimate stuck code field now surfaces as a fast, specific failure, not a 180s timeout, so future
  regressions here are diagnosable from the report instead of a bare budget-exceeded.
- `fillAndArm` is a test-mechanics guard local to this spec; it does not touch the product, which keeps a
  single native `.fill()` + click (a real user types then clicks an already-interactive page).
- Limitation (not-assessed locally): the green-across-repeats claim can only be confirmed on CI; this ADR
  records the mechanism and the fix, not a local reproduction.

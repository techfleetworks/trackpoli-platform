# 0035. A Deno integration-test harness for the Edge Functions, served against the real local Supabase stack

Date: 2026-11-18

## Status

Accepted

Builds on the invite / manage-admins edge functions (TP1-09, TP1-10, ADR-0020, ADR-0021), the full-stack E2E
harness (ADR-0033) and the E2E-only seed overlay (ADR-0034). Adds a new test tier under
`supabase/tests/functions/` (`_harness.ts`, `invite-admins.test.ts`, `manage-admins.test.ts`) run by
`deno test`, and a new `function-tests` job in `.github/workflows/database.yml`. No application `src/` or
`supabase/functions/` code changes.

## Context

Two TODO items (TP1-09, TP1-10 in `docs/TODO.md`) called for **stack-dependent edge-function tests** that the
repo could not yet run: invite-side (duplicate email, rollback, rate limit, stale terms) and manage-side
(last-manager, deactivate session-kill, recreate snapshot, change-email rollback/unlink). Three test tiers
already exist, each owning a different layer:

- **pgTAP** (`supabase/tests/database/`) — the data layer: RLS access matrix, the append-only/immutable guards,
  the last-manager guard (migration 002, `20_guards_and_append_only.test.sql`), the lockout
  (`50_lockout.test.sql`), the terms gate (`60_terms_gate.test.sql`), plus the race
  (`supabase/tests/race/last_manager_race.sh`).
- **vitest** (`npm run test:unit`) — the Next app's route/service units, with the gate-script tests.
- **Playwright full-stack** (`e2e/*.full-stack.spec.ts`) — the browser-driven acceptance journeys through the
  app and (via the app) the functions.

What **none** of them covers is the edge handler's own HTTP contract and multi-step orchestration **in
isolation**: the `_shared/serve` envelope and status mapping, `verifyCaller`'s auth/aal2/manager gating, the
zod `.strict()` validation, and — the cases the tickets name — the rollbacks (`invite-admin` deleting the
just-created auth user on a profile-insert failure; `change-email` restoring the auth email on a profile-write
failure), the fixed-window rate limit on `resend-invite`, the `record-terms` stale-version conflict, the
`deactivate-admin` session revoke, and the `recreate-admin` account_deleted snapshot that must be written
**before** the delete so the audit trail survives. These are properties of the **function layer**, provable
only against the **served edge runtime + the real local Supabase stack** (duplicate, rollback, session-kill and
snapshot are all real-stack side effects — a pure mock would assert the mock, not the behaviour).

`skeptical-audit` applies to the boundary with pgTAP: the **last-manager guard and its race are already owned
and proven at the data layer** (migration 002 + `20_guards` + `last_manager_race.sh`). The function layer does
not re-prove the race (a function-level concurrency race is timing-fragile and would only re-assert the DB's
serialization). It proves the **function's contribution**: that `isLastManagerGuard` maps the guard's Postgres
error to a clean `409 last_manager`, and that the self-target guards (`cannot_target_self`) fire first.

## Decision

**1. A new Deno integration tier under `supabase/tests/functions/`, run by `deno test`.** The functions are
Deno; their tests are Deno, placed beside the other `supabase/tests/` suites (not in `e2e/`, which is Playwright
+ the app). Each test drives a function over **HTTP** at `${SUPABASE_URL}/functions/v1/<name>` — the same path
and envelope the app uses (`src/features/auth/edgeClient.ts`) — and asserts the **true DB side effects** with a
service-role client, never a mock. The tier is credential-free exactly like the full-stack E2E job: Turnstile
is not on these post-auth paths, and the only secret is the committed-test `INTERNAL_CALL_SECRET`.

**2. Mint real `aal2` manager sessions programmatically, not through the UI.** The harness
(`supabase/tests/functions/_harness.ts`) creates ephemeral users with the service role
(`auth.admin.createUser` + a `profiles` insert — there is no auto-profile trigger; the invite flow and
`seed.sql` both insert the profile explicitly), signs them in, and completes a TOTP enrol + verify to obtain a
genuine `aal2` access token (the same `aal` claim `verifyCaller` reads). This exercises the real GoTrue MFA path
and the real token, with no browser.

**3. Ephemeral, self-cleaning fixtures — do not touch the base cast or the E2E overlay.** Every test creates its
own uniquely-addressed people (`<prefix>-<uuid>@example.test`) and deletes them in a `finally`, so tests do not
depend on `seed.sql` identities and cannot collide. The job does **not** load `supabase/seed-e2e.sql` (that
overlay is the Playwright job's, ADR-0034). The base `seed.sql` is loaded by `db reset` and left intact.

**4. Force the rollback paths deterministically with a `citext`-email collision, no fault injection.** The
rollbacks are reached honestly: a **deactivated** profile whose `profiles.email` differs from its **auth** email
lets `invite-admin` / `change-email` pass the (deactivated-is-free) pre-check and succeed at the auth step, then
**fail on the `profiles.email` unique index** — which is exactly the profile-write failure the contract rolls
back. The test then asserts the rollback's observable effect (the just-created auth user is gone;
`change-email`'s auth email is restored to the old address), so a planted no-op rollback is caught.

**5. Last-manager: prove the function's 409 mapping with a deterministic collapse-and-restore; cite pgTAP for
the race.** One test reduces the active-manager count to a single ephemeral manager (deactivating the seed
managers one at a time — each step still leaves ≥1, so the guard permits it), has that sole manager self-demote
through `change-role`, and asserts `409 last_manager`; a `finally` reactivates the seed managers. No sleeps, no
concurrency — deterministic. The **race** stays cited to `20_guards` + `last_manager_race.sh`.

**6. A new `function-tests` CI job in `database.yml`, mirroring the stack boot.** `database.yml` already triggers
on `supabase/**` and boots a real stack. The new job writes `supabase/functions/.env` (the committed-test
`INTERNAL_CALL_SECRET`), runs `supabase start` + `supabase db reset` (which serves the functions and loads the
base seed), exports the local anon + service-role keys, sets up Deno (pinned action + version), and runs
`deno test` with those keys in its env. It is isolated from `db-tests` (its own job, its own stack).

Rejected alternatives:

- **Unit-test the handlers with mocked Supabase clients.** The named cases are real-stack behaviours (a `citext`
  unique collision, GoTrue session revoke, the account_deleted row surviving a delete); a mock would assert the
  mock. Rejected — these are integration properties.
- **Drive the functions through the app in Playwright instead.** The app path is already covered by the
  full-stack specs; it cannot isolate the handler's own contract (an app-level validation would mask a missing
  function-level zod check), and a browser is far heavier than `deno test` for an HTTP+DB assertion. Rejected.
- **Reuse the `seed-e2e.sql` overlay people.** Couples this tier to the Playwright overlay and to shared mutable
  state; ephemeral self-cleaning fixtures are better isolated. Rejected.
- **Re-prove the last-manager race at the function layer.** Timing-fragile and redundant with
  `last_manager_race.sh`; the DB owns the race. Rejected (`skeptical-audit`).
- **Make `function-tests` a required merge check now.** The merge-protection ruleset apply is parked
  (out of scope). The job runs on every PR to `supabase/**`; promoting it to required is a separate ruleset change.

## Consequences

The edge functions gain a tier that proves, against the real served runtime, the contract and orchestration no
other tier owns: auth/aal2/manager gating, validation, both rollbacks, the resend rate limit, the stale-terms
conflict, the deactivate session-kill, and the recreate snapshot. The last-manager guard keeps its proof split
across the layer that owns it (pgTAP + race) and the function's 409 mapping (this tier). A future function or
`_shared` change can be regression-checked here; a new case adds a `Deno.test` to the matching file.

**Verifiable-quality-gates:** the tier is proven to *detect*, not merely to pass. Each rollback/guard test
asserts the observable effect a planted no-op would break (auth user still present after a failed invite, auth
email left diverged after a failed change-email, no `409` when the guard mapping is removed), and the detection
is demonstrated by a planted-defect CI run recorded with this change (see the PR / arch-review log).

**Honest limits (not-assessed here):** there is **no local Docker/Supabase on the authoring machine**, so the
green `deno test` run is **owed from CI** and may need first-run iteration (the likely adjustments: the pinned
Deno version string, the exact `supabase start` function-serving behaviour, the GoTrue MFA enrol/verify shape,
and `activity_events` column names read by the snapshot assertions). The **Google-identity unlink** on
`change-email` (Q-1-24) stays **domain-blocked**: no live Google-linked account exists in CI, so the harness
proves the email/session half and that the unlink path runs without error on an unlinked account; the real
Google round-trip remains owed (ADR-0021, `docs/TODO.md`). The job is **not** a required merge check (the
ruleset apply is parked).

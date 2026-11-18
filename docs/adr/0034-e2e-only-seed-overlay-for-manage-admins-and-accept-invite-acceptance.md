# 0034. An E2E-only seed overlay for the manage-admins and accept-invite acceptance specs

Date: 2026-11-18

## Status

Accepted

Builds on the full-stack E2E harness (PR #67, ADR-0033) and the manage-admins / invite edge functions
(TP1-09, TP1-10, ADR-0020, ADR-0021). Adds `supabase/seed-e2e.sql`, un-fixmes E2E-03 in
`e2e/accept-invite.full-stack.spec.ts`, implements `e2e/manage-admins.full-stack.spec.ts`, and wires both into
the `e2e (full stack)` CI job in `.github/workflows/e2e.yml`. The base `supabase/seed.sql` is **unchanged**.

## Context

The last acceptance gap in the full-stack suite was four stubbed specs: E2E-03 (accept-invite happy path) and
E2E-09 / E2E-10 / E2E-17 (manage administrators). Making them real needs dedicated test people: an acting
Administrator Manager that signs in and enrols two-factor, a deactivation target, a recreate target, and a
second acting manager for the invite flow. An acting manager **must** be an active `admin_manager`.

The natural move — add those people to `supabase/seed.sql` — is a trap, because the base seed's 7-person cast
is a **contract that the pgTAP database tests assert by exact count**:

- `supabase/tests/database/60_terms_gate.test.sql` asserts a manager, once past the terms gate, sees
  **exactly 7** profiles (`'val:7'`, twice).
- `supabase/tests/database/20_guards_and_append_only.test.sql` walks a last-manager narrative that assumes
  **exactly three** active managers (mia/max/tom): it demotes one, deactivates another, and then asserts the
  third is "the only active manager" and that removing them throws `last_admin_manager`.

Adding **any** profile breaks the terms-gate count; adding an **active manager** additionally falsifies the
last-manager narrative (the acting manager would still be active, so mia would no longer be "the last"). The
brief for this work is explicit that the 7-person cast is fully allocated and cross-coupled to other specs
(E2E-05 changes mia's password, E2E-07/08 enrol bea, E2E-11 enrols abe, E2E-15 uses tom/max) and must **not**
be disturbed. `skeptical-audit` applies: the honest reading is that `seed.sql` is load-bearing for the
database job, and expanding it would couple E2E fixtures to pgTAP cast invariants that belong to other tickets.

A second, separate question is **E2E-10's last-manager guard**. The scenario
(`features/admins/manage-admins.feature` `@usecase:E2E-10`) has two halves: the self-target refusal
(`cannot_target_self`) and the last-Administrator-Manager demotion guard. The self refusal is cleanly
UI-testable. The last-manager guard, however, is **global** — it counts every active manager in `profiles` —
so it can only fire when the acting manager is genuinely the last active manager, which in the one un-reset
seeded DB would require deactivating mia/max/tom, i.e. disturbing the shared cast other specs depend on. The
guard is already proven race-free at the layer that owns it (migration 002) by
`supabase/tests/database/20_guards_and_append_only.test.sql` (a demote, a deactivate, a status move and a
delete that would remove the last manager all throw `last_admin_manager`) and by
`supabase/tests/race/last_manager_race.sh` under concurrency; the `@usecase:change-role-last-manager` scenario
carries that behaviour.

## Decision

**1. Keep the dedicated E2E people in a separate overlay, not in the base seed.** Add
`supabase/seed-e2e.sql` carrying four dedicated active people — `mgr-manage` (manage-admins acting manager),
`tgt-deactivate` (E2E-09 target), `tgt-recreate` (E2E-17 target), and `mgr-invite` (accept-invite acting
manager) — built with the exact seed patterns (`auth.users` with the non-null token columns, the
`auth.identities` email-identity row, the `profiles` row, `policy_acceptances`). It is applied with `psql -f`
**after** `supabase db reset`, only in the `e2e (full stack)` job (one added workflow step). It is **not** run
by `supabase db reset`, so the pgTAP database job (`database.yml` → `supabase test db`) and the safe-sessions
job keep the exact 7-person cast their invariants assert. Distinct `@example.test` emails are the row
selectors, so no scenario collides with another person in the shared DB. The base seed's documented cast
contract and every pgTAP count stay untouched.

**2. Narrow E2E-10's UI assertion to the self-target refusal; cite the pgTAP coverage for the last-manager
guard.** The UI spec asserts the honestly-reachable half (deactivating your own account surfaces
`cannot_target_self`), and documents, in the spec and here, that the last-manager demotion guard is proven at
the data layer (migration 002 pgTAP + the race test). This avoids a flaky or dishonest UI path that would have
to deactivate the shared cast to manufacture a "last manager".

**3. One shared acting-manager session per manage-admins run, enrolled once.** The three manage-admins tests
run `test.describe.serial` with the acting manager signed in and MFA-enrolled once in `beforeAll`; re-enrolling
per test is not safely repeatable against the un-reset DB (a manager who already has a factor routes to
`/verify`, not `/enrol` — the same hazard E2E-08/E2E-11 document). Retries are off, each test targets a
different dedicated person, and E2E-03 creates its invitee at runtime via the real manager-facing invite path
(`/admin/api/admins/action` → `invite-admin`, ADR-0005), reading the link from the Mailpit catcher.

Rejected alternatives:

- **Expand `supabase/seed.sql` with the dedicated people.** Breaks `60_terms_gate` (count 7 → 11) and
  `20_guards` (3 active managers → more), i.e. disturbs the shared cast contract other tickets own. Rejected.
- **Expand `seed.sql` and also update the pgTAP counts.** Edits other tickets' database tests to accommodate
  E2E fixtures, coupling two layers that should stay independent. Rejected — keep the fixtures out of the
  cast-coupled base.
- **Make E2E-10 deactivate mia/max/tom to reach "last manager", then assert the UI guard.** Disturbs the
  shared cast in the serial DB and is inherently order-fragile. Rejected on `skeptical-audit` (non-flaky,
  honest option) — the guard is already proven at the data layer.
- **A fresh acting manager per manage-admins test.** More seed people for no benefit; one shared, once-enrolled
  session is simpler and matches the established isolation pattern.

## Consequences

The four acceptance specs become executable and merge-blocking in the `e2e (full stack)` job without touching
the base seed or any pgTAP test, so the database and safe-sessions jobs are unaffected. The E2E stack now has a
documented two-file seed (base cast + E2E overlay); a future full-stack spec that needs its own people adds
them to the overlay, never the cast-coupled base. The last-manager guard keeps full coverage split across the
layer that owns it (pgTAP, migration 002) and the UI (self refusal), which is the honest, non-flaky division.

**Honest limits (not-assessed here):** the overlay and specs are verified locally only up to typecheck, lint,
`check:architecture`, `check:gherkin`, `check:bdd-tags` and the unit suite — the full-stack run itself cannot
be reproduced on this machine (no local Docker/Supabase), so like every prior full-stack spec the green run is
owed from CI and the specs may need CI iteration (the likely first-run adjustments are the Mailpit API path for
the invite link and the invite-email timing). The `psql` overlay step assumes `DB_URL` from
`supabase status -o env` and `psql` on the runner (preinstalled on `ubuntu-latest`); the `ON_ERROR_STOP=1` step
fails the job closed if the overlay does not apply cleanly.

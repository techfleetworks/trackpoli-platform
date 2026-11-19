# Edge-function integration tests (Deno)

Stack-dependent tests for the Supabase Edge Functions, run by `deno test` against the **served edge runtime +
the real local Supabase stack** (TP1-09, TP1-10; **ADR-0035**). They assert the true HTTP contract and DB side
effects — never mocks.

## What this tier owns

The edge handler's own contract and orchestration, which no other tier isolates:

- auth / `aal2` / manager gating (`_shared/auth.ts` `verifyCaller`), zod `.strict()` validation, the `_shared/serve`
  envelope and status mapping;
- **invite-admin**: `email_in_use` pre-check; the rollback that deletes the just-created auth user on a profile
  insert failure;
- **resend-invite**: the fixed-window rate limit (3 / admin / hour) with `Retry-After`;
- **record-terms**: the stale-version `409 conflict`;
- **deactivate-admin**: the authoritative status change + the session-kill (`revoke_user_sessions`) + the event;
- **recreate-admin**: the `account_deleted` snapshot written **before** the delete, and the new-id re-invite;
- **change-email**: auth-first/profile-second update, the rollback that restores the auth email on a profile-write
  failure, the session revoke, and the (unlinked-account) unlink path;
- the function's `last_manager` **409 mapping** of the DB guard's error.

## What it deliberately does NOT own (cited, not duplicated)

- The **last-manager guard and its race** — proven at the layer that owns it: `supabase/tests/database/20_guards_and_append_only.test.sql` (migration 002) + `supabase/tests/race/last_manager_race.sh`.
- The **deactivation lockout / RLS-denies-non-active** — `supabase/tests/database/50_lockout.test.sql`.
- The **terms gate** (RLS) — `supabase/tests/database/60_terms_gate.test.sql`.
- The **Google-identity unlink** round-trip — domain-blocked (Q-1-24 / ADR-0021); the harness proves the
  email/session half and that the unlink path runs without error on an unlinked account.

## Running

Locally needs Docker + the Supabase CLI (not available on every machine, so the green run is owed from CI):

```
supabase start && supabase db reset
supabase status -o env   # export ANON_KEY / SERVICE_ROLE_KEY
# the edge functions read APP_URL for the invite redirect; set it in supabase/functions/.env
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  INTERNAL_CALL_SECRET=e2e-internal-call-secret \
  deno test --allow-all --node-modules-dir=auto --no-check supabase/tests/functions/
```

CI runs it as the `function-tests` job in `.github/workflows/database.yml`. Tests create ephemeral,
uniquely-addressed, self-cleaning people; they do not touch the base `seed.sql` cast or the `seed-e2e.sql`
overlay.

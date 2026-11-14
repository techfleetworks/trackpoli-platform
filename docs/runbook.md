# TrackPoli Admin — operations runbook

What to do when an alert fires or the team must recover the workspace (TP1-13, P1-15/P1-16;
sre-operational-readiness). Each alert in `monitoring/alerts/trackpoli-admin.yml` links to a section here.
This runbook is reviewed as part of the Phase 1 exit; the live firing of the alerts is demonstrated on staging
once the stack is deployed (Q-1-21).

> **Evidence spine.** Every server failure is written to `operational_events` (durable, queryable) **and** to
> Sentry (alertable), both with a `request_id`, a release and an environment, and **never** an email, name,
> token or request body (`supabase/functions/_shared/events.ts`, `src/lib/sentry.ts`). Start every
> investigation from the `request_id`.

## App down

The uptime probe cannot reach the admin app for 5 minutes (`AdminAppDown`, NFR-O1).

1. Check the Vercel deployment status and the Cloudflare status for the zone.
2. Check Sentry for a spike of server errors around the first failing probe; pivot on `release`.
3. If a bad release is implicated, roll back to the previous Vercel deployment (instant rollback).
4. If Cloudflare is the cause, confirm the `/admin/*` rules and DNS; fail over per the Cloudflare plan.

## Sign-in errors

More than 5% of sign-in requests return 5xx for 5 minutes (`SignInErrorRateHigh`).

1. In Sentry, group the sign-in errors; check whether `sign-in-check` (Edge Function) or Turnstile is failing.
2. Verify the Supabase Auth service and the `INTERNAL_CALL_SECRET` match between the app and the functions.
3. If Turnstile is rejecting everything, confirm the site/secret keys; a provider outage is an upstream cause.
4. Roll back the last deploy if the error began at a release boundary.

## Edge Function errors

More than 2% of Edge Function invocations error for 5 minutes (`EdgeFunctionErrorRateHigh`, NFR-O2).

1. Identify the failing function from the `component` tag in Sentry / `operational_events.component`.
2. Check the Supabase Functions logs and the service-role key / env for that function.
3. A single function (e.g. `change-email`) failing points to its own dependency (GoTrue admin API); a broad
   failure points to the shared `serve`/auth path or a Supabase incident.

## Failed sign-ins

Ten or more failed sign-ins in 5 minutes (`FailedSignInsSpike`) — a possible credential-stuffing attempt.

1. This is a **ticket + Sentry issue**, not a page: no user-facing outage, but investigate.
2. In `operational_events` / Sentry, review the source IPs and whether they target one account or many.
3. The per-account and per-IP rate limits (migration 004) and Turnstile already throttle this; if a single
   account is targeted, consider notifying its holder. Do not disable the rate limits.

## Email failure

One or more invite / recovery / security-notice emails failed to send in 15 minutes (`AuthEmailSendFailures`).

1. The account change itself still succeeded (sends are best-effort, reported, never undone) — this is about
   **delivery**, not data integrity.
2. Confirm the Porkbun SMTP secrets in Supabase (`SMTP_HOST/PORT/USER/PASS/FROM`) and the SPF/DKIM/DMARC DNS
   on `trackpoli.com`. See the TP1-12 follow-ups in `docs/TODO.md`.
3. Send a test recovery email and confirm delivery to a real Gmail and Outlook inbox (not spam).

## Last-manager lockout (break-glass)

The workspace must never be left with no active Administrator Manager. The database guard (migration 002)
refuses any demote/deactivate/delete that would remove the last active manager, so the app cannot cause this.
If a lockout still occurs (e.g. the sole manager loses their authenticator), follow the break-glass procedure
in [`docs/runbooks/mfa-device-recovery.md`](runbooks/mfa-device-recovery.md): an operator with Supabase access
restores or re-creates a manager account directly, under the two-person control described there.

## Account recreation

A standard lost-authenticator recovery is self-service for a manager: use **Manage administrators → Recreate**
(TP1-10), which deletes the old account and sends a fresh invite, keeping the name/email snapshot in the
`account_deleted` audit event. Only the break-glass path above needs operator-level access.

## Key rotation

Rotate on a schedule and immediately on suspected exposure. After rotating any secret, redeploy so the new
value is picked up, and confirm no `*_secret`/`SERVICE_ROLE` value appears in the built bundle (the
built-bundle secret scan in the security checklist).

- **`INTERNAL_CALL_SECRET`** (app ↔ Edge Functions): set the new value in both the Vercel env and the Supabase
  function secrets in the same change, or internal calls will 403.
- **`SUPABASE_SERVICE_ROLE_KEY`**: rotate in Supabase, update the function secrets; never ships to the client.
- **SMTP password** (Porkbun): rotate in Porkbun, update `SMTP_PASS`.
- **`SENTRY_DSN`**: rotate in Sentry, update the app env and the function secrets.

## Ownership transfer

To hand over the workspace (e.g. the first/seeded manager leaves): a current manager invites the new owner and
promotes them to Administrator Manager (TP1-10 change-role), confirms the new manager can sign in at aal2, then
deactivates the departing account. The last-manager guard ensures an active manager always remains during the
transfer.

## Operational-events retention and purge

`operational_events` is retained for **90 days** (NFR-D2/D3) and purged by
`public.purge_operational_events()` (migration 009). Schedule it once pg_cron is enabled on the Supabase
project (the statement is kept, commented, at the end of migration 009):

```sql
select cron.schedule('purge-operational-events', '17 3 * * *', 'select public.purge_operational_events()');
```

Confirm the job with `select * from cron.job;` after enabling. This is an infra step (Q-1-21) tracked in
`docs/TODO.md`.

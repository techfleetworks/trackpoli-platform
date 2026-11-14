# 0024. Observability: shared Sentry scrubbing, an edge envelope sink, and symptom-based alerts

Date: 2026-11-13

## Status

Accepted

The observability half of TP1-13 (P1-15). Builds on the reporting spine ([0005](0005-admin-auth-cookie-sessions-and-enumeration-resistant-sign-in.md)),
the operational-log contract ([0021](0021-manage-administrators-authoritative-status-best-effort-side-effects-and-delete-then-reinvite.md)),
and the "fail-closed but inert" posture for domain-blocked infrastructure ([0015](0015-staging-deploy-self-skips-until-configured-fail-closed-but-inert.md)).
(The hardening half of TP1-13 — security headers + CSP nonce, and the NFR/security evidence — lands in its own
PRs with their own ADRs.)

## Context

TP1-13's P1-15 goals: Sentry for browser + server, **scrubbed**, tagged with request id + user id (never the
email); server failures to **both** `operational_events` and Sentry; symptom-based alerts with runbook links; a
90-day purge scheduled. The repo already had DSN-gated Sentry init (`src/instrumentation*.ts`) and a
report→Sentry forward, but **no scrubbing, no user/request tagging, no edge-side Sentry, no alert rules, and no
runbook**. Open points:

1. **How is PII kept out of Sentry**, given reports can carry an email, a token or a password in a message or
   context?
2. **How do the Deno Edge Functions reach Sentry**, when they cannot use `@sentry/nextjs`?
3. **What fires a page vs a ticket**, so on-call is not paged for noise?
4. **How is the 90-day purge scheduled** without a CI-fragile migration?

## Decision

**One shared scrubbing config for the Next runtimes; a pure envelope POST for the edge; symptom-only paging;
all inert until a DSN exists.**

- **Shared scrub config (resolves 1).** `src/lib/sentry.ts` owns `scrubString`/`scrubContext`/`scrubEvent` (redact
  emails, JWTs, bearer tokens; redact PII-named keys; drop request headers/cookies/query/body; reduce the user
  to its id) and `sentryBaseOptions` (no tracing, `sendDefaultPii:false`, release + environment, `beforeSend` =
  the scrubber). Both `instrumentation.ts` (server) and `instrumentation-client.ts` (browser) init with it, and
  `report.ts` scrubs the message + context and sets the Sentry user to `{id}` from a `userId` in context —
  never the email. Data minimization at the sink (compliance-data-lifecycle), proven by unit tests.
- **Edge envelope sink (resolves 2).** The Edge Functions POST a minimal Sentry **envelope** to the DSN ingest
  endpoint. The builder (`supabase/functions/_shared/sentryEnvelope.ts`) is a pure Deno/Node module (unit-tested
  in Node, like `noticeTemplates.ts`); `_shared/sentry.ts` is the thin `captureServerError` side-effect.
  `writeOperationalError` now writes to `operational_events` **and** forwards to Sentry — the fields it carries
  are already PII-free by its contract, so no extra scrub is needed edge-side.
- **Symptom-only paging (resolves 3).** `monitoring/alerts/trackpoli-admin.yml` pages only on user-facing
  symptoms (uptime availability, sign-in 5xx rate > 5%, Edge Function error rate > 2%); the two security/delivery
  signals (10 failed sign-ins / 5 min; auth-email send failures) are **tickets**, not pages. Every rule has a
  severity, a summary/description and a runbook link; `check:alerts` enforces this.
- **Purge documented, not migrated (resolves 4).** `purge_operational_events()` exists (migration 009). The
  `cron.schedule` statement is kept commented at the end of that migration and written up in `docs/runbook.md`;
  scheduling it is a one-time infra step once pg_cron is enabled (Q-1-21), not a new migration that would fail
  in CI where pg_cron is absent.
- **Inert until configured.** No DSN → nothing is sent, and the Sentry SDK (Next) and the envelope POST (edge)
  are never reached; the mailer/SDK are loaded dynamically only when configured. Same ADR-0015 posture as the
  email transport (ADR-0023).

## Consequences

- **Good.** One scrub discipline across browser, server and edge; PII cannot reach Sentry even if a caller
  passes it; the durable log and the alertable sink always agree; on-call pages only on symptoms; it all turns
  on the moment a DSN is set, with no code change.
- **Cost.** Two scrub layers (report + beforeSend) — deliberate defence in depth. The edge envelope is a
  hand-built POST rather than an SDK, so it tracks only the fields we send (adequate for operational errors).
- **Limitation (evidence state: not-assessed).** The scrubbing and the envelope building are unit-tested now,
  but **live delivery to Sentry, the alert firing, and the purge schedule are domain/account-gated** (the
  Sentry DSN + a deployed stack + pg_cron), so the ticket's "appears in Sentry" / "alert fires in staging" /
  purge are demonstrated on staging later and tracked in `docs/TODO.md`. The edge POST to the Sentry ingest
  endpoint is asserted from the documented envelope format, not observed.

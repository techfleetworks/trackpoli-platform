// Edge-function Sentry sink (TP1-13, P1-15). The Next app reports through @sentry/nextjs; the Deno edge
// functions cannot use that SDK, so they POST a minimal Sentry *envelope* straight to the DSN's ingest
// endpoint. Active ONLY when SENTRY_DSN is set (inert otherwise, like the rest of the domain-blocked infra).
//
// The payload is built from the operational-error fields, which already carry NO personal data by contract
// (events.ts / AGENTS.md: component, errorCode, message, requestId, actor id, release, environment — never an
// email, name, token or request body). So there is nothing to scrub here; the envelope just forwards those
// PII-free fields. The envelope BUILDER is the pure sentryEnvelope.ts (unit-tested in Node); this file is only
// the thin side-effect that reads the DSN and POSTs, fire-and-forget, never throwing.

import { buildSentryEnvelope, type SentryServerEvent } from "./sentryEnvelope.ts";

export type { SentryServerEvent, SentryLevel } from "./sentryEnvelope.ts";

/** POST one server event to Sentry when SENTRY_DSN is set. Fire-and-forget; swallows its own failure so
 *  reporting can never mask the operational failure it is reporting. Inert when no DSN is configured. */
export async function captureServerError(event: SentryServerEvent): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;
  const enriched: SentryServerEvent = {
    ...event,
    release: event.release ?? Deno.env.get("RELEASE") ?? null,
    environment: event.environment ?? Deno.env.get("ENVIRONMENT") ?? null,
  };
  const envelope = buildSentryEnvelope(dsn, enriched);
  if (!envelope) return;
  // Fire-and-forget: a failed Sentry forward must never mask or fail the operational-error write it follows,
  // so the network error is swallowed via .catch (the repo's reporting-spine idiom, not an empty try/catch).
  // A 2s timeout bounds the latency this forward can add to the error path (it is awaited after the durable
  // log_error write), so a slow or hung Sentry never drags on the request.
  await fetch(envelope.url, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body: envelope.body,
    signal: AbortSignal.timeout(2000),
  }).catch(() => undefined);
}

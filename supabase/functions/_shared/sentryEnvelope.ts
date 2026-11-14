// Pure Sentry-envelope builder (TP1-13, P1-15). No Deno, no network, no env — only `crypto.randomUUID` and
// `URL`, which exist in both Deno and Node. So the Deno edge sink (sentry.ts) imports it, and the Node test
// suite imports it by relative path to prove the DSN parsing, the ingest URL and the envelope shape in CI.

export type SentryLevel = "warning" | "error" | "critical";

export interface SentryServerEvent {
  level: SentryLevel;
  message: string;
  component: string;
  errorCode?: string | null;
  requestId: string;
  actor?: string | null;
  release?: string | null;
  environment?: string | null;
}

export interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
}

/** Parse a Sentry DSN (`https://<publicKey>@<host>/<projectId>`) into its parts, or null if it is malformed.
 *  Parsed with a regex rather than `new URL()` so a malformed value is a plain null, not a thrown-and-caught
 *  error (keeps the arch-gate "no swallowed catch" rule satisfied). */
export function parseDsn(dsn: string): ParsedDsn | null {
  const match = /^https?:\/\/([^@:/\s]+)@([^/\s]+)\/(\S+)$/.exec(dsn.trim());
  if (!match) return null;
  return { publicKey: match[1], host: match[2], projectId: match[3] };
}

// Sentry's level vocabulary: our "critical" maps to Sentry "fatal".
function sentryLevel(level: SentryLevel): string {
  return level === "critical" ? "fatal" : level;
}

/** Build the ingest URL + newline-delimited envelope body for one event, or null if the DSN is malformed.
 *  Pure — `eventId`/`sentAt` are injectable so a test is deterministic. */
export function buildSentryEnvelope(
  dsn: string,
  event: SentryServerEvent,
  opts: { eventId?: string; sentAt?: string } = {},
): { url: string; body: string } | null {
  const parsed = parseDsn(dsn);
  if (!parsed) return null;
  const eventId = (opts.eventId ?? crypto.randomUUID()).replace(/-/g, "");
  const sentAt = opts.sentAt ?? new Date().toISOString();
  const url = `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`;

  const envelopeHeader = { event_id: eventId, sent_at: sentAt, dsn };
  const itemHeader = { type: "event" };
  const payload = {
    event_id: eventId,
    level: sentryLevel(event.level),
    message: event.message,
    platform: "other",
    logger: "edge_function",
    release: event.release ?? undefined,
    environment: event.environment ?? undefined,
    tags: { component: event.component, error_code: event.errorCode ?? "none" },
    extra: { request_id: event.requestId, actor: event.actor ?? null },
  };
  const body = `${JSON.stringify(envelopeHeader)}\n${JSON.stringify(itemHeader)}\n${JSON.stringify(payload)}`;
  return { url, body };
}

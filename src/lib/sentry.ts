// Shared Sentry configuration (TP1-13, P1-15). One place defines HOW the app talks to Sentry, so the browser
// (instrumentation-client.ts) and the server (instrumentation.ts) apply the SAME scrubbing and the same
// tagging. Sentry is the reporting sink (ADR-0005); it is active ONLY when a DSN is set, so local dev and a
// secret-less build send nothing. The scrubber strips anything that looks like an email, a JWT/bearer token
// or a password, and redacts known-PII keys, so a report can never carry personal data to Sentry
// (compliance-data-lifecycle: data minimization — the operational log keeps the same discipline). The only
// identifiers attached are a request id and a user id, NEVER the email (the Sentry user is {id} only, and
// sendDefaultPii is off so Sentry does not infer an IP/cookie identity).

// A JWT-ish triple (header.payload.signature); redact before the email rule so its dots are not mistaken.
const JWT_RE = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER_RE = /\b[Bb]earer\s+[A-Za-z0-9._~+/=-]+/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Redact emails, JWTs and bearer tokens from a free-text string. Order matters: token patterns first. */
export function scrubString(input: string): string {
  return input
    .replace(JWT_RE, "[redacted-token]")
    .replace(BEARER_RE, "Bearer [redacted-token]")
    .replace(EMAIL_RE, "[redacted-email]");
}

// Keys whose VALUE is sensitive regardless of content: redacted wholesale (not just pattern-scrubbed).
const PII_KEYS = new Set([
  "email", "password", "current_password", "currentpassword", "new_password", "newpassword",
  "token", "access_token", "refresh_token", "authorization", "apikey", "api_key", "secret", "cookie",
]);

// Recursion bound: Sentry contexts are shallow JSON, so a handful of levels covers every real case while
// guaranteeing termination even on an unexpected deep or cyclic structure.
const MAX_SCRUB_DEPTH = 6;

/** Scrub one value: redact string patterns, recurse into arrays and plain objects (redacting PII-named keys),
 *  and pass other primitives through. Bounded by MAX_SCRUB_DEPTH. */
function scrubValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return scrubString(value);
  if (depth >= MAX_SCRUB_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = PII_KEYS.has(key.toLowerCase()) ? "[redacted]" : scrubValue(inner, depth + 1);
  }
  return out;
}

/** Redact PII-named keys and scrub values of the rest, recursing into nested objects and arrays so a secret
 *  nested inside the context bag is redacted too (not only top-level strings). */
export function scrubContext(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = PII_KEYS.has(key.toLowerCase()) ? "[redacted]" : scrubValue(value, 1);
  }
  return out;
}

// The subset of a Sentry event this scrubber touches. Loosely typed so it does not depend on the SDK's types.
export interface ScrubbableEvent {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  request?: { headers?: unknown; cookies?: unknown; query_string?: unknown; data?: unknown };
  user?: { id?: string | number; email?: string; ip_address?: string };
}

/** beforeSend: scrub the message, the exception values and the extra/context bags, and drop request headers,
 *  cookies, query string and body (which can carry a token or an email). The user is reduced to its id. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (typeof event.message === "string") event.message = scrubString(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === "string") ex.value = scrubString(ex.value);
  }
  if (event.extra) event.extra = scrubContext(event.extra);
  if (event.contexts) event.contexts = scrubContext(event.contexts);
  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.query_string;
    delete event.request.data;
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : {};
  return event;
}

function release(): string | undefined {
  return process.env.RELEASE ?? process.env.NEXT_PUBLIC_RELEASE ?? undefined;
}
function environment(): string | undefined {
  return process.env.ENVIRONMENT ?? process.env.NEXT_PUBLIC_ENVIRONMENT ?? process.env.NODE_ENV;
}

/** The common Sentry.init options for both runtimes: no performance tracing, no default PII, release +
 *  environment tags, and the scrubber as beforeSend. The caller passes the DSN it resolved. */
export function sentryBaseOptions(dsn: string) {
  return {
    dsn,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    release: release(),
    environment: environment(),
    beforeSend: (event: ScrubbableEvent) => scrubEvent(event),
  };
}

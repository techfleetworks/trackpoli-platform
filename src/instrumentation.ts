// Server/edge error reporting (ADR-0005 reporting spine). Sentry is the reporting sink for the app; it is
// initialised ONLY when a DSN is configured, so local dev and the build without secrets are unaffected.
// The dynamic import keeps Sentry out of the bundle until a DSN is present. onRequestError forwards
// server-side request/render errors to Sentry automatically.

import type { Instrumentation } from "next";
import { sentryBaseOptions } from "@/lib/sentry";

function dsn(): string | undefined {
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export async function register(): Promise<void> {
  const configured = dsn();
  if (!configured) return;
  const Sentry = await import("@sentry/nextjs");
  // Shared options (TP1-13): no tracing, no default PII, release + environment tags, and the scrubber as
  // beforeSend so no email/token/password reaches Sentry. The scrubber is deliberately typed against our own
  // loose ScrubbableEvent (not the SDK's exact Event), so the options are cast to init's parameter type.
  Sentry.init(sentryBaseOptions(configured) as unknown as Parameters<typeof Sentry.init>[0]);
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (!dsn()) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
};

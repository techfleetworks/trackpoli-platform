// The app's reporting spine. decisions.md (Error handling) requires every failure to "recover/retry AND
// report through the app's reporting spine" — a console.error alone is not reporting. This is the single
// seam the client/server app reports through: it emits a structured line (always, machine-greppable) and,
// for warning/error, forwards to Sentry when a DSN is configured (Sentry is initialised in
// src/instrumentation*.ts). report() never throws: reporting must not mask the original failure.

import { scrubString, scrubContext } from "@/lib/sentry";

export type Severity = "debug" | "info" | "warning" | "error";

export interface ReportContext {
  readonly [key: string]: string | number | boolean | null | undefined;
}

export function report(severity: Severity, message: string, context: ReportContext = {}): void {
  const line = JSON.stringify({ at: "report", severity, message, ...context });
  if (severity === "error" || severity === "warning") {
    console.error(line);
    forwardToSentry(severity, message, context);
  } else {
    console.info(line);
  }
}

// Forward an explicit report to Sentry when a DSN is set. Skipped in the edge runtime (middleware), where
// Sentry is not initialised, and when no DSN is configured. The message and the context are scrubbed (so no
// email/token/password reaches Sentry even though beforeSend also scrubs — defence in depth), and a `userId`
// in the context becomes the Sentry user id (never the email). Fire-and-forget and never throws.
function forwardToSentry(severity: "warning" | "error", message: string, context: ReportContext): void {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (!(process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN)) return;
  const userId = typeof context.userId === "string" ? context.userId : undefined;
  void import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.captureMessage(scrubString(message), {
        level: severity,
        extra: scrubContext({ ...context }),
        user: userId ? { id: userId } : undefined,
      }),
    )
    .catch(() => undefined);
}

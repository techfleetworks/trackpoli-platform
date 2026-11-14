// Browser error reporting (ADR-0005). Sentry is initialised in the browser only when a public DSN is set; the
// dynamic import keeps it out of the main bundle otherwise. It uses the SAME shared options as the server
// (TP1-13): no tracing, no default PII, release + environment tags, and the beforeSend scrubber, so an
// unhandled client error is captured with no email/token/password attached.

import { sentryBaseOptions } from "@/lib/sentry";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs")
    .then((Sentry) => {
      // Cast: the scrubber is typed against our loose ScrubbableEvent, not the SDK's exact Event.
      Sentry.init(sentryBaseOptions(dsn) as unknown as Parameters<typeof Sentry.init>[0]);
    })
    .catch(() => undefined);
}

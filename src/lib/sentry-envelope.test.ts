import { describe, it, expect } from "vitest";

// The edge Sentry envelope builder is a pure module shared with the Deno edge functions; vitest imports it by
// relative path to prove the DSN parsing, the ingest URL, the envelope shape and the level mapping in CI
// (the edge runtime itself is not unit-tested here).
import {
  parseDsn,
  buildSentryEnvelope,
  type SentryServerEvent,
} from "../../supabase/functions/_shared/sentryEnvelope";

const DSN = "https://abc123publickey@o4509.ingest.sentry.io/123456";
const EVENT: SentryServerEvent = {
  level: "critical",
  message: "security notice send failed: password_changed",
  component: "send-security-notice",
  errorCode: "security_notice_send_failed",
  requestId: "req-42",
  actor: "user-1",
  release: "r1",
  environment: "staging",
};

describe("parseDsn", () => {
  it("splits a valid DSN into publicKey/host/projectId", () => {
    expect(parseDsn(DSN)).toEqual({
      publicKey: "abc123publickey",
      host: "o4509.ingest.sentry.io",
      projectId: "123456",
    });
  });
  it("returns null for a malformed DSN", () => {
    expect(parseDsn("not a dsn")).toBeNull();
    expect(parseDsn("https://o4509.ingest.sentry.io/123456")).toBeNull(); // no public key
  });
});

describe("buildSentryEnvelope", () => {
  it("builds the ingest URL and a 3-line envelope with the mapped level and no PII", () => {
    const out = buildSentryEnvelope(DSN, EVENT, { eventId: "fixedid", sentAt: "2026-11-14T00:00:00.000Z" })!;
    expect(out.url).toBe(
      "https://o4509.ingest.sentry.io/api/123456/envelope/?sentry_key=abc123publickey&sentry_version=7",
    );
    const lines = out.body.split("\n");
    expect(lines).toHaveLength(3);
    const header = JSON.parse(lines[0]);
    const payload = JSON.parse(lines[2]);
    expect(header.dsn).toBe(DSN);
    expect(payload.level).toBe("fatal"); // "critical" → Sentry "fatal"
    expect(payload.tags).toEqual({ component: "send-security-notice", error_code: "security_notice_send_failed" });
    expect(payload.extra).toEqual({ request_id: "req-42", actor: "user-1" });
    // The event payload carries no email (the operational fields are PII-free by contract). The envelope
    // header legitimately contains the DSN (which has an "@"), so this checks the payload line only.
    expect(lines[2]).not.toMatch(/@/);
  });

  it("returns null when the DSN is malformed", () => {
    expect(buildSentryEnvelope("nope", EVENT)).toBeNull();
  });
});

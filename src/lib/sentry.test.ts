import { describe, it, expect } from "vitest";

import { scrubString, scrubContext, scrubEvent } from "./sentry";

describe("scrubString", () => {
  it("redacts emails, JWTs and bearer tokens but keeps ordinary text", () => {
    expect(scrubString("contact amara@example.com now")).toBe("contact [redacted-email] now");
    expect(scrubString("Bearer abc.def.ghi-TOKEN_value")).toContain("[redacted-token]");
    const jwt = "eyJhbGciOi.eyJzdWIiOiIx.SflKxwRJSMeKKF2";
    expect(scrubString(`token=${jwt}`)).not.toContain(jwt);
    expect(scrubString("a plain message with no secrets")).toBe("a plain message with no secrets");
  });
});

describe("scrubContext", () => {
  it("redacts PII-named keys wholesale and scrubs string values of the rest", () => {
    const out = scrubContext({
      email: "amara@example.com",
      password: "hunter2hunter2",
      requestId: "req-123",
      note: "sent to amara@example.com",
      attempt: 3,
    });
    expect(out.email).toBe("[redacted]");
    expect(out.password).toBe("[redacted]");
    expect(out.requestId).toBe("req-123");
    expect(out.note).toBe("sent to [redacted-email]");
    expect(out.attempt).toBe(3);
  });

  it("recurses into nested objects and arrays (a secret nested in the bag is still redacted)", () => {
    const out = scrubContext({
      meta: { password: "hunter2hunter2", trail: ["ok", "mailto amara@example.com"] },
    });
    const meta = out.meta as { password: string; trail: string[] };
    expect(meta.password).toBe("[redacted]");
    expect(meta.trail[1]).toBe("mailto [redacted-email]");
  });
});

describe("scrubEvent (beforeSend)", () => {
  it("scrubs the message + exception, drops request headers/cookies/body, and reduces the user to its id", () => {
    const event = scrubEvent({
      message: "login failed for amara@example.com",
      exception: { values: [{ value: "token eyJhbGciOi.eyJzdWIiOiIx.SflKxwRJSMeKKF2 leaked" }] },
      extra: { email: "amara@example.com", requestId: "req-9" },
      request: { headers: { cookie: "sb=secret" }, cookies: { sb: "secret" }, query_string: "t=abc", data: { password: "x" } },
      user: { id: "user-1", email: "amara@example.com", ip_address: "1.2.3.4" },
    });
    expect(event.message).toBe("login failed for [redacted-email]");
    expect(event.exception?.values?.[0].value).toContain("[redacted-token]");
    expect(event.extra?.email).toBe("[redacted]");
    expect(event.extra?.requestId).toBe("req-9");
    expect(event.request?.headers).toBeUndefined();
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.user).toEqual({ id: "user-1" });
  });

  it("empties the user when there is no id (never keeps an email-only identity)", () => {
    const event = scrubEvent({ user: { email: "amara@example.com" } });
    expect(event.user).toEqual({});
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { requestAccessMailto, supportEmail } from "./requestAccess";

describe("supportEmail", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to support@trackpoli.com when the env var is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "");
    expect(supportEmail()).toBe("support@trackpoli.com");
  });

  it("uses NEXT_PUBLIC_SUPPORT_EMAIL (trimmed) when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "  managers@example.test  ");
    expect(supportEmail()).toBe("managers@example.test");
  });
});

describe("requestAccessMailto", () => {
  afterEach(() => vi.unstubAllEnvs());

  function parse(href: string) {
    expect(href.startsWith("mailto:")).toBe(true);
    const [scheme, query] = href.split("?");
    const to = scheme.slice("mailto:".length);
    const params = new URLSearchParams(query);
    return { to, subject: params.get("subject") ?? "", body: params.get("body") ?? "" };
  }

  it("addresses the default support email and keeps the @ raw", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "");
    const { to } = parse(requestAccessMailto({ requesterEmail: "ada@example.test", attemptedPath: "/admins" }));
    expect(to).toBe("support@trackpoli.com");
  });

  it("honours an explicit recipient override", () => {
    const { to } = parse(
      requestAccessMailto({ requesterEmail: "ada@example.test", attemptedPath: "/admins", to: "boss@example.test" }),
    );
    expect(to).toBe("boss@example.test");
  });

  it("includes the requester email and attempted path in the body", () => {
    const { subject, body } = parse(
      requestAccessMailto({ requesterEmail: "ada@example.test", attemptedPath: "/admins" }),
    );
    expect(subject).toBe("Access request: Administrator manager section");
    expect(body).toContain("Requester: ada@example.test");
    expect(body).toContain("Attempted page: /admins");
  });

  it("falls back to readable placeholders when email or path is missing", () => {
    const { body } = parse(requestAccessMailto({ requesterEmail: null, attemptedPath: null }));
    expect(body).toContain("Requester: (not signed in)");
    expect(body).toContain("Attempted page: (not specified)");
  });

  it("clamps a pathological attempted path to 200 characters", () => {
    const long = "/" + "a".repeat(500);
    const { body } = parse(requestAccessMailto({ requesterEmail: "ada@example.test", attemptedPath: long }));
    const line = body.split("\n").find((l) => l.startsWith("Attempted page: "))!;
    expect(line.length).toBe("Attempted page: ".length + 200);
  });

  it("neutralises a mailto-parameter injection in the attempted path", () => {
    // The real mailto injection vector is an unencoded "&" that would add a new parameter (e.g. &cc=...).
    // A caller-influenced ?from carrying "&cc=" must stay inside the body, not become a cc header, and raw
    // CR/LF must be percent-encoded so the URL has no control characters.
    const href = requestAccessMailto({
      requesterEmail: "ada@example.test",
      attemptedPath: "/x&cc=attacker@evil.test\r\n",
    });
    expect(href).not.toMatch(/\r|\n/);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("cc")).toBeNull(); // no injected parameter
    expect(params.get("body")).toContain("&cc=attacker@evil.test"); // hostile text stays literal in the body
  });

  it("uses %20 for spaces in the query, not +", () => {
    const href = requestAccessMailto({ requesterEmail: "ada@example.test", attemptedPath: "/admins" });
    const query = href.split("?")[1];
    expect(query).not.toContain("+");
    expect(query).toContain("%20");
  });
});

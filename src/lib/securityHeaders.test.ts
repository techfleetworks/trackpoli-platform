import { describe, it, expect, afterEach } from "vitest";

import {
  generateNonce,
  buildCsp,
  cspEnforced,
  cspHeaderName,
  securityHeaderEntries,
  STATIC_SECURITY_HEADERS,
} from "./securityHeaders";

const ORIGINAL = process.env.CSP_ENFORCE;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CSP_ENFORCE;
  else process.env.CSP_ENFORCE = ORIGINAL;
});

describe("generateNonce", () => {
  it("returns a non-empty base64 nonce that differs each call", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(a).not.toBe(b);
  });
});

describe("buildCsp", () => {
  it("nonces scripts with strict-dynamic, denies framing, and allowlists the known third parties", () => {
    const csp = buildCsp("TESTNONCE");
    expect(csp).toContain("script-src 'self' 'nonce-TESTNONCE' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("https://*.ingest.sentry.io");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://accounts.google.com");
    // No blanket script escape hatch.
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});

describe("CSP mode toggle", () => {
  it("defaults to report-only when CSP_ENFORCE is unset", () => {
    delete process.env.CSP_ENFORCE;
    expect(cspEnforced()).toBe(false);
    expect(cspHeaderName()).toBe("Content-Security-Policy-Report-Only");
  });

  it("enforces when CSP_ENFORCE is truthy", () => {
    process.env.CSP_ENFORCE = "1";
    expect(cspEnforced()).toBe(true);
    expect(cspHeaderName()).toBe("Content-Security-Policy");
  });
});

describe("securityHeaderEntries", () => {
  it("includes the static headers and the CSP under the active name", () => {
    delete process.env.CSP_ENFORCE;
    const entries = securityHeaderEntries("N1");
    const map = new Map(entries);
    expect(map.get("Strict-Transport-Security")).toContain("max-age=");
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe(STATIC_SECURITY_HEADERS["Referrer-Policy"]);
    expect(map.get("Permissions-Policy")).toContain("geolocation=()");
    expect(map.has("Content-Security-Policy-Report-Only")).toBe(true);
    expect(map.get("Content-Security-Policy-Report-Only")).toContain("'nonce-N1'");
    expect(map.has("Content-Security-Policy")).toBe(false);
  });
});

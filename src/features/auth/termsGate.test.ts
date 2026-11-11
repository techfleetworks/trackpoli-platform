import { describe, it, expect } from "vitest";

import { decideTermsGate, TERMS_EXEMPT_PATHS } from "./termsGate";

describe("decideTermsGate (TP1-08 — the live terms gate)", () => {
  it("allows an anonymous request (the sign-in guard owns that case)", () => {
    expect(decideTermsGate({ path: "/politicians", authenticated: false, termsAccepted: false }).action).toBe("allow");
  });

  it("routes an authenticated, not-accepted session to /terms on a protected path", () => {
    expect(decideTermsGate({ path: "/politicians", authenticated: true, termsAccepted: false }).action).toBe("terms");
  });

  it("routes a not-accepted session to /terms even on the MFA funnel (terms come before two-factor)", () => {
    expect(decideTermsGate({ path: "/mfa/enrol", authenticated: true, termsAccepted: false }).action).toBe("terms");
    expect(decideTermsGate({ path: "/sign-in/verify", authenticated: true, termsAccepted: false }).action).toBe("terms");
  });

  it("allows an accepted session through", () => {
    expect(decideTermsGate({ path: "/politicians", authenticated: true, termsAccepted: true }).action).toBe("allow");
  });

  it("fails open when acceptance cannot be read (null) — RLS still blocks the data", () => {
    expect(decideTermsGate({ path: "/politicians", authenticated: true, termsAccepted: null }).action).toBe("allow");
  });

  it("never redirects away from the exempt paths (no funnel deadlock)", () => {
    for (const path of TERMS_EXEMPT_PATHS) {
      expect(decideTermsGate({ path, authenticated: true, termsAccepted: false }).action).toBe("allow");
      // and a sub-path of each stays allowed too
      expect(decideTermsGate({ path: `${path}/x`, authenticated: true, termsAccepted: false }).action).toBe("allow");
    }
  });

  it("allows the session-establishment passthrough paths (an OAuth callback must complete, not redirect)", () => {
    expect(decideTermsGate({ path: "/auth/callback", authenticated: true, termsAccepted: false }).action).toBe("allow");
    expect(decideTermsGate({ path: "/api/sign-in", authenticated: true, termsAccepted: false }).action).toBe("allow");
    expect(decideTermsGate({ path: "/session-expired", authenticated: true, termsAccepted: false }).action).toBe("allow");
  });

  it("funnels an authenticated, un-accepted session off /sign-in to /terms (terms-first)", () => {
    expect(decideTermsGate({ path: "/sign-in", authenticated: true, termsAccepted: false }).action).toBe("terms");
  });
});

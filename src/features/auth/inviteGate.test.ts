import { describe, expect, it } from "vitest";
import { decideInviteGate } from "./inviteGate";

// decideInviteGate is a pure routing rule (TP1-09). It runs after the terms gate and before RequireMfa: an
// invited session (live status "invited") is routed to /accept-invite on a gated path; everything else allows.

describe("decideInviteGate", () => {
  it("leaves an anonymous request to the other gates", () => {
    expect(decideInviteGate({ path: "/dashboard", authenticated: false, status: "invited" })).toEqual({
      action: "allow",
    });
  });

  it("routes an invited session on a gated path to /accept-invite", () => {
    for (const path of ["/", "/dashboard", "/records", "/settings/profile", "/mfa/enrol", "/sign-in/verify"]) {
      expect(decideInviteGate({ path, authenticated: true, status: "invited" }).action).toBe("accept-invite");
    }
  });

  it("allows an invited session on the accept-invite screen and its API (no self-redirect loop)", () => {
    for (const path of ["/accept-invite", "/api/accept-invite"]) {
      expect(decideInviteGate({ path, authenticated: true, status: "invited" })).toEqual({ action: "allow" });
    }
  });

  it("allows an invited session on the terms funnel (terms come first)", () => {
    for (const path of ["/terms", "/api/terms"]) {
      expect(decideInviteGate({ path, authenticated: true, status: "invited" })).toEqual({ action: "allow" });
    }
  });

  it("allows an invited session on sign-out and the activity ping (no deadlock)", () => {
    for (const path of ["/api/sign-out", "/api/session/activity"]) {
      expect(decideInviteGate({ path, authenticated: true, status: "invited" })).toEqual({ action: "allow" });
    }
  });

  it("allows the session-establishment passthrough (OAuth callbacks, sign-in API, reauth)", () => {
    for (const path of ["/auth/callback", "/auth/google", "/auth/reauth", "/api/sign-in", "/session-expired"]) {
      expect(decideInviteGate({ path, authenticated: true, status: "invited" })).toEqual({ action: "allow" });
    }
  });

  it("allows an active session on any path (it is past activation)", () => {
    for (const path of ["/", "/dashboard", "/mfa/enrol"]) {
      expect(decideInviteGate({ path, authenticated: true, status: "active" })).toEqual({ action: "allow" });
    }
  });

  it("allows a deactivated or unreadable status (the other gates and RLS handle those)", () => {
    expect(decideInviteGate({ path: "/dashboard", authenticated: true, status: "deactivated" })).toEqual({
      action: "allow",
    });
    // Fail open on an unreadable status: RLS still limits an invited session to its own row.
    expect(decideInviteGate({ path: "/dashboard", authenticated: true, status: null })).toEqual({
      action: "allow",
    });
  });
});

// @vitest-environment node
// A route handler is server code: run it under node (undici Request/Response), not the project-default jsdom,
// whose Response polyfill does not give NextResponse a real status/body.
//
// Regression + contract test for POST /admin/api/mfa/replace. The endpoint had NO test and shipped a schema
// that threw "Duplicate discriminator value 'authorize'" on every call (a z.discriminatedUnion with two
// "authorize" members), so every device-replacement attempt 500'd (found by the full-stack E2E-11 harness).
// These cases pin the body contract: each valid shape is parsed and routed to the right core and returns a
// 200 JSON outcome, a malformed body returns the safe reauth_failed outcome, and NOTHING here is a 500 — a
// revert to the duplicate-discriminator schema makes the valid-body parse throw and fails the first case.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// vi.mock factories are hoisted above module-top consts, so the mock fns must be created with vi.hoisted().
const mocks = vi.hoisted(() => ({
  authorizeReplacement: vi.fn(async (_input: unknown, _ports?: unknown) => ({
    outcome: "authorized",
    enrol: { factorId: "f-new" },
  })),
  completeReplacement: vi.fn(async (_input: unknown, _ports?: unknown) => ({ outcome: "replaced" })),
  notifySecurityChange: vi.fn(async () => undefined),
  getUser: vi.fn(async () => ({ data: { user: { id: "u-1", email: "abe@example.test" } } })),
}));

vi.mock("@/features/auth/mfa", () => ({
  buildReplacePorts: () => ({}),
  authorizeReplacement: mocks.authorizeReplacement,
  completeReplacement: mocks.completeReplacement,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/reauthMarker", () => ({
  REAUTH_MARKER_COOKIE: "reauth",
  verifyReauthMarker: () => true,
}));
vi.mock("@/features/auth/securityNotice", () => ({
  notifySecurityChange: mocks.notifySecurityChange,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "marker" }) }),
}));

import { POST } from "./route";

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/admin/api/mfa/replace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /admin/api/mfa/replace body schema", () => {
  beforeEach(() => {
    mocks.authorizeReplacement.mockClear();
    mocks.completeReplacement.mockClear();
    mocks.notifySecurityChange.mockClear();
  });

  it("parses a password authorize body and routes it to authorizeReplacement (200, not 500)", async () => {
    const res = await POST(post({ step: "authorize", method: "password", password: "pw", currentCode: "123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: "authorized", enrol: { factorId: "f-new" } });
    expect(mocks.authorizeReplacement).toHaveBeenCalledTimes(1);
    expect(mocks.authorizeReplacement.mock.calls[0][0]).toMatchObject({ proof: { kind: "password" } });
    expect(mocks.completeReplacement).not.toHaveBeenCalled();
  });

  it("parses a google authorize body and routes it to authorizeReplacement", async () => {
    const res = await POST(post({ step: "authorize", method: "google", currentCode: "123456" }));
    expect(res.status).toBe(200);
    expect(mocks.authorizeReplacement).toHaveBeenCalledTimes(1);
    expect(mocks.authorizeReplacement.mock.calls[0][0]).toMatchObject({ proof: { kind: "google" } });
  });

  it("parses a complete body and routes it to completeReplacement", async () => {
    const res = await POST(post({ step: "complete", newFactorId: "f-new", newCode: "123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: "replaced" });
    expect(mocks.completeReplacement).toHaveBeenCalledTimes(1);
    expect(mocks.authorizeReplacement).not.toHaveBeenCalled();
  });

  it("returns the safe reauth_failed outcome for a malformed body, never a 500", async () => {
    const res = await POST(post({ step: "authorize", method: "password" })); // missing password + currentCode
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: "reauth_failed" });
    expect(mocks.authorizeReplacement).not.toHaveBeenCalled();
  });

  it("rejects a body with unexpected extra fields (strict), returning reauth_failed", async () => {
    const res = await POST(post({ step: "complete", newFactorId: "f", newCode: "123456", extra: true }));
    expect(await res.json()).toEqual({ outcome: "reauth_failed" });
    expect(mocks.completeReplacement).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

// Regression test for the device-replacement enrol collision (found by the full-stack E2E-11 harness).
// buildMfaPorts.enroll() must give each factor a UNIQUE, non-empty friendly name: Supabase enforces unique
// friendly names per user, and replacement enrols the NEW factor while the current one is still verified, so
// two unnamed factors collide with "A factor with the friendly name '' for this user already exists" (a 500,
// device replacement broken). Reverting the fix (dropping friendlyName) makes the first case fail.

const mocks = vi.hoisted(() => ({
  enroll: vi.fn(async (_opts: { factorType: string; friendlyName?: string }) => ({
    data: { id: "factor-new", totp: { qr_code: "qr", secret: "ABCDEF", uri: "otpauth://x" } },
    error: null,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { mfa: { enroll: mocks.enroll } } }),
}));

import { buildMfaPorts } from "./mfa";

describe("buildMfaPorts.enroll — friendly name", () => {
  beforeEach(() => mocks.enroll.mockClear());

  it("enrols with a non-empty TOTP friendly name so a replacement factor never collides with the current one", async () => {
    await buildMfaPorts().enroll();
    expect(mocks.enroll).toHaveBeenCalledTimes(1);
    const arg = mocks.enroll.mock.calls[0][0];
    expect(arg.factorType).toBe("totp");
    expect(typeof arg.friendlyName).toBe("string");
    expect((arg.friendlyName ?? "").length).toBeGreaterThan(0);
  });

  it("uses a distinct friendly name on each enrol (so the new device's factor differs from the current one)", async () => {
    await buildMfaPorts().enroll();
    await buildMfaPorts().enroll();
    const first = mocks.enroll.mock.calls[0][0].friendlyName;
    const second = mocks.enroll.mock.calls[1][0].friendlyName;
    expect(first).not.toBe(second);
  });
});

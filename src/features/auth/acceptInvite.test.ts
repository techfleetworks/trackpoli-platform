import { describe, expect, it, vi } from "vitest";
import {
  acceptInvite,
  ActivationSessionGone,
  type AcceptInvitePorts,
} from "./acceptInvite";

// Unit tests for the accept-invite (activation) orchestration with fake ports (TP1-09). The security-critical
// guarantee is judge-arch L1: the password is set ONLY while the account is live-status 'invited', so this
// route can never be an un-reauthenticated password change for an already-active administrator.

const PASSWORD = "correct-horse-battery-staple"; // >= 12 chars

function ports(overrides: Partial<AcceptInvitePorts> = {}): AcceptInvitePorts {
  return {
    getStatus: vi.fn().mockResolvedValue("invited"),
    updatePassword: vi.fn().mockResolvedValue({ ok: true }),
    activate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("acceptInvite", () => {
  it("activates an invited account: sets the password then calls complete-invite", async () => {
    const p = ports();
    const result = await acceptInvite({ password: PASSWORD, ip: "1.2.3.4" }, p);
    expect(result).toEqual({ outcome: "done" });
    expect(p.updatePassword).toHaveBeenCalledWith(PASSWORD);
    expect(p.activate).toHaveBeenCalledWith("1.2.3.4");
  });

  it("L1: an already-active caller is sent on WITHOUT changing the password", async () => {
    const p = ports({ getStatus: vi.fn().mockResolvedValue("active") });
    const result = await acceptInvite({ password: PASSWORD, ip: null }, p);
    expect(result).toEqual({ outcome: "done" });
    // The credential is never touched for an active account — the core L1 guarantee.
    expect(p.updatePassword).not.toHaveBeenCalled();
    expect(p.activate).not.toHaveBeenCalled();
  });

  it("treats an unreadable or non-active, non-invited status as a spent invite (no_session)", async () => {
    for (const status of ["deactivated", null] as const) {
      const p = ports({ getStatus: vi.fn().mockResolvedValue(status) });
      const result = await acceptInvite({ password: PASSWORD, ip: null }, p);
      expect(result).toEqual({ outcome: "no_session" });
      expect(p.updatePassword).not.toHaveBeenCalled();
    }
  });

  it("reports a below-policy password as weak and does not activate", async () => {
    const p = ports({ updatePassword: vi.fn().mockResolvedValue({ ok: false }) });
    const result = await acceptInvite({ password: "short", ip: null }, p);
    expect(result).toEqual({ outcome: "weak_password" });
    expect(p.activate).not.toHaveBeenCalled();
  });

  it("maps a gone/forbidden activation session to no_session", async () => {
    const p = ports({ activate: vi.fn().mockRejectedValue(new ActivationSessionGone()) });
    const result = await acceptInvite({ password: PASSWORD, ip: null }, p);
    expect(result).toEqual({ outcome: "no_session" });
  });

  it("rethrows an unexpected activation failure (becomes a 5xx the client retries)", async () => {
    const p = ports({ activate: vi.fn().mockRejectedValue(new Error("edge 500")) });
    await expect(acceptInvite({ password: PASSWORD, ip: null }, p)).rejects.toThrow("edge 500");
  });
});

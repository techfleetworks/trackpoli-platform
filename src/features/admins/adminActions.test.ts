import { describe, it, expect, vi } from "vitest";

import { callAdminAction, ACTION_TO_FUNCTION, type AdminActionPorts } from "./adminActions";
import { EdgeFunctionError } from "@/features/auth/edgeClient";

function ports(overrides: Partial<AdminActionPorts> = {}): AdminActionPorts {
  return {
    getAccessToken: async () => "tok-123",
    ip: "203.0.113.9",
    invoke: async () => ({ id: "a1" }),
    ...overrides,
  };
}

describe("callAdminAction", () => {
  it("maps the action verb to its edge function and forwards token, payload and ip", async () => {
    const invoke = vi.fn(async () => ({ id: "a1", from: "admin", to: "admin_manager" }));
    const result = await callAdminAction(
      "change-role",
      { admin_id: "a1", role: "admin_manager" },
      ports({ invoke }),
    );

    expect(invoke).toHaveBeenCalledWith(
      ACTION_TO_FUNCTION["change-role"], // "change-role"
      { admin_id: "a1", role: "admin_manager" },
      "tok-123",
      "203.0.113.9",
    );
    expect(result).toEqual({ ok: true, data: { id: "a1", from: "admin", to: "admin_manager" } });
  });

  it("maps every UI verb to the expected edge function name", () => {
    expect(ACTION_TO_FUNCTION).toMatchObject({
      invite: "invite-admin",
      resend: "resend-invite",
      revoke: "revoke-invite",
      "change-role": "change-role",
      "change-email": "change-email",
      deactivate: "deactivate-admin",
      reactivate: "reactivate-admin",
      recreate: "recreate-admin",
    });
  });

  it("relays an expected edge failure as a typed { ok:false, code } the client can branch on", async () => {
    const invoke = vi.fn(async () => {
      throw new EdgeFunctionError("last_manager", "You cannot remove the last Administrator Manager");
    });
    const result = await callAdminAction("deactivate", { admin_id: "a1" }, ports({ invoke }));
    expect(result).toEqual({
      ok: false,
      code: "last_manager",
      message: "You cannot remove the last Administrator Manager",
      retryAfterSeconds: undefined,
    });
  });

  it("carries Retry-After through for a rate_limited resend", async () => {
    const invoke = vi.fn(async () => {
      throw new EdgeFunctionError("rate_limited", "Too many resends", 1800);
    });
    const result = await callAdminAction("resend", { admin_id: "a1" }, ports({ invoke }));
    expect(result).toMatchObject({ ok: false, code: "rate_limited", retryAfterSeconds: 1800 });
  });

  it("returns unauthenticated without invoking when the session token is gone", async () => {
    const invoke = vi.fn();
    const result = await callAdminAction("deactivate", { admin_id: "a1" }, ports({ getAccessToken: async () => null, invoke }));
    expect(invoke).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, code: "unauthenticated", message: "Your session has expired. Sign in again." });
  });

  it("rethrows an unexpected (non-edge) error so it surfaces as a 500", async () => {
    const invoke = vi.fn(async () => {
      throw new TypeError("network down");
    });
    await expect(callAdminAction("change-email", { admin_id: "a1", new_email: "x@y.org" }, ports({ invoke }))).rejects.toThrow(
      "network down",
    );
  });
});

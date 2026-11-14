import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/edgeClient", () => ({
  invokeInternalFunction: vi.fn(),
  EdgeFunctionError: class EdgeFunctionError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("@/lib/report", () => ({ report: vi.fn() }));

import { notifySecurityChange } from "./securityNotice";
import { invokeInternalFunction, EdgeFunctionError } from "@/features/auth/edgeClient";
import { report } from "@/lib/report";

const mockInvoke = vi.mocked(invokeInternalFunction);
const mockReport = vi.mocked(report);

describe("notifySecurityChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires the internal send-security-notice function with the type and the server-resolved user id", async () => {
    mockInvoke.mockResolvedValue({ dispatched: true } as never);
    await notifySecurityChange("password_changed", "user-1");
    expect(mockInvoke).toHaveBeenCalledWith(
      "send-security-notice",
      { type: "password_changed", user_id: "user-1" },
      null,
    );
    expect(mockReport).not.toHaveBeenCalled();
  });

  it("swallows a dispatch failure (never throws) so the account change is never undone, and reports it", async () => {
    mockInvoke.mockRejectedValue(new EdgeFunctionError("internal", "boom"));
    await expect(notifySecurityChange("two_factor_replaced", "user-2")).resolves.toBeUndefined();
    expect(mockReport).toHaveBeenCalledWith(
      "warning",
      "security notice dispatch failed",
      expect.objectContaining({ type: "two_factor_replaced", reason: "internal" }),
    );
  });
});

import { describe, it, expect, vi } from "vitest";

import { changePassword, type ChangePasswordPorts } from "./changePassword";

function ports(overrides: Partial<ChangePasswordPorts> = {}): ChangePasswordPorts {
  return {
    getPasswordEmail: async () => "amara@trackpoli.org",
    verifyCurrent: async () => true,
    updatePassword: async () => ({ ok: true }),
    ...overrides,
  };
}

describe("changePassword", () => {
  it("verifies the current password, updates, and returns done", async () => {
    const verifyCurrent = vi.fn(async () => true);
    const updatePassword = vi.fn(async () => ({ ok: true }));
    const result = await changePassword(
      { currentPassword: "old-correct-horse", newPassword: "new-correct-horse-battery" },
      ports({ verifyCurrent, updatePassword }),
    );
    expect(verifyCurrent).toHaveBeenCalledWith("amara@trackpoli.org", "old-correct-horse");
    expect(updatePassword).toHaveBeenCalledWith("new-correct-horse-battery");
    expect(result).toEqual({ outcome: "done" });
  });

  it("returns not_available and never verifies/updates for a Google-only account", async () => {
    const verifyCurrent = vi.fn();
    const updatePassword = vi.fn();
    const result = await changePassword(
      { currentPassword: "x", newPassword: "new-correct-horse-battery" },
      ports({ getPasswordEmail: async () => null, verifyCurrent, updatePassword }),
    );
    expect(result).toEqual({ outcome: "not_available" });
    expect(verifyCurrent).not.toHaveBeenCalled();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("returns wrong_password and NEVER updates when the current password fails to verify", async () => {
    const updatePassword = vi.fn();
    const result = await changePassword(
      { currentPassword: "guess", newPassword: "new-correct-horse-battery" },
      ports({ verifyCurrent: async () => false, updatePassword }),
    );
    expect(result).toEqual({ outcome: "wrong_password" });
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("returns weak_password when GoTrue rejects the new password", async () => {
    const result = await changePassword(
      { currentPassword: "old-correct-horse", newPassword: "short" },
      ports({ updatePassword: async () => ({ ok: false }) }),
    );
    expect(result).toEqual({ outcome: "weak_password" });
  });
});

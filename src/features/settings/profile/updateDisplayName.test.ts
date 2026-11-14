import { describe, it, expect, vi } from "vitest";

import { updateDisplayName, type UpdateDisplayNamePorts } from "./updateDisplayName";

function ports(overrides: Partial<UpdateDisplayNamePorts> = {}): UpdateDisplayNamePorts {
  return {
    getUserId: async () => "u1",
    update: async () => ({ ok: true }),
    ...overrides,
  };
}

describe("updateDisplayName", () => {
  it("trims and updates, returning the saved name", async () => {
    const update = vi.fn(async () => ({ ok: true }));
    const result = await updateDisplayName({ displayName: "  Amara Nwosu  " }, ports({ update }));
    expect(update).toHaveBeenCalledWith("u1", "Amara Nwosu");
    expect(result).toEqual({ outcome: "done", displayName: "Amara Nwosu" });
  });

  it("rejects an empty (whitespace-only) name without a write", async () => {
    const update = vi.fn();
    const result = await updateDisplayName({ displayName: "   " }, ports({ update }));
    expect(result).toEqual({ outcome: "invalid" });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a name over 120 characters", async () => {
    const result = await updateDisplayName({ displayName: "a".repeat(121) }, ports());
    expect(result).toEqual({ outcome: "invalid" });
  });

  it("returns no_session when there is no signed-in user", async () => {
    const update = vi.fn();
    const result = await updateDisplayName({ displayName: "Amara" }, ports({ getUserId: async () => null, update }));
    expect(result).toEqual({ outcome: "no_session" });
    expect(update).not.toHaveBeenCalled();
  });

  it("surfaces a refused write as error", async () => {
    const result = await updateDisplayName({ displayName: "Amara" }, ports({ update: async () => ({ ok: false }) }));
    expect(result).toEqual({ outcome: "error" });
  });
});

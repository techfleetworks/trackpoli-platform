import { describe, it, expect } from "vitest";

import { shellDisplayName } from "./displayName";

describe("shellDisplayName", () => {
  it("prefers the profile display name when present", () => {
    expect(shellDisplayName({ display_name: "Ada Lovelace", email: "ada@example.test" })).toBe("Ada Lovelace");
  });

  it("falls back to the email when the display name is null", () => {
    expect(shellDisplayName({ display_name: null, email: "ada@example.test" })).toBe("ada@example.test");
  });

  it("falls back to the email when the display name is blank/whitespace", () => {
    expect(shellDisplayName({ display_name: "   ", email: "ada@example.test" })).toBe("ada@example.test");
  });

  it("falls back to a generic label when neither name nor email is available", () => {
    expect(shellDisplayName({ display_name: null, email: null })).toBe("Administrator");
    expect(shellDisplayName({ display_name: "  ", email: "  " })).toBe("Administrator");
  });

  it("trims a display name with surrounding whitespace", () => {
    expect(shellDisplayName({ display_name: "  Bea Boss  ", email: "bea@example.test" })).toBe("Bea Boss");
  });
});

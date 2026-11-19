import { describe, it, expect } from "vitest";
import { listParties, getPartyBySlug } from "./listParties";
import { PARTY_FIXTURES } from "./parties.fixtures";

// Covers the directory reader's behaviour (bdd-comprehensive-testing / comprehensive-test-strategy):
// the happy path (no query), plus the edge/negative cases the live search and quick filter must hold.
describe("listParties", () => {
  it("returns every party in registry order when no query is given (happy path)", () => {
    const result = listParties();
    expect(result).toHaveLength(PARTY_FIXTURES.length);
    expect(result.map((p) => p.slug)).toEqual(PARTY_FIXTURES.map((p) => p.slug));
  });

  it("matches search against name, abbreviation and symbol, case-insensitively", () => {
    expect(listParties({ search: "progressives" }).map((p) => p.slug)).toEqual(["apc", "apga"]);
    expect(listParties({ search: "APC" }).map((p) => p.slug)).toEqual(["apc"]);
    expect(listParties({ search: "umbrella" }).map((p) => p.slug)).toEqual(["pdp"]); // symbol
  });

  it("trims and ignores empty or whitespace-only search (boundary)", () => {
    expect(listParties({ search: "   " })).toHaveLength(PARTY_FIXTURES.length);
    expect(listParties({ search: "  apc  " }).map((p) => p.slug)).toEqual(["apc"]);
  });

  it("returns an empty array when nothing matches (negative), never throws", () => {
    expect(listParties({ search: "no-such-party" })).toEqual([]);
  });

  it("filters to registered parties only when the quick filter is set", () => {
    const registered = listParties({ registration: "registered" });
    expect(registered.every((p) => p.registrationStatus === "registered")).toBe(true);
  });

  it("combines search and registration filter", () => {
    expect(listParties({ search: "party", registration: "registered" }).length).toBeGreaterThan(0);
    expect(listParties({ search: "zzz", registration: "registered" })).toEqual([]);
  });

  it("getPartyBySlug returns the matching party, or undefined for an unknown slug", () => {
    expect(getPartyBySlug("apc")?.name).toBe("All Progressives Congress");
    expect(getPartyBySlug("does-not-exist")).toBeUndefined();
  });

  it("does not mutate the underlying fixtures (data ownership)", () => {
    const before = PARTY_FIXTURES.length;
    listParties({ search: "apc" }).sort();
    expect(PARTY_FIXTURES).toHaveLength(before);
    expect(PARTY_FIXTURES[0].slug).toBe("apc");
  });
});

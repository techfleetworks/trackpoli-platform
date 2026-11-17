import { describe, it, expect } from "vitest";

import { config } from "./middleware";

// Regression guard for the basePath root gap (E2E-11): with basePath "/admin", Next prefixes the glob
// matcher with the basePath, so the glob alone never matches the bare "/admin" root (the dashboard). The
// explicit "/" entry restores the middleware gate — forced two-factor enrolment, session timeout, terms and
// role — on the landing page. Removing "/" would silently bypass all of those there.
describe("middleware matcher", () => {
  it("gates the application root in addition to every sub-path", () => {
    expect(config.matcher).toContain("/");
  });

  it("still covers sub-paths via the asset-excluding glob", () => {
    expect(config.matcher.some((m) => m.includes("_next/static") && m.includes("(?!"))).toBe(true);
  });
});

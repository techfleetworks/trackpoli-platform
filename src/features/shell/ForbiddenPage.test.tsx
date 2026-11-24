import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthState } from "@/features/auth/AuthProvider";
import { useAuth } from "@/features/auth/useAuth";
import { ForbiddenPage } from "./ForbiddenPage";

const from = vi.fn<() => string | null>(() => "/admins");
vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: () => from() }) }));
vi.mock("@/features/auth/useAuth", () => ({ useAuth: vi.fn() }));

const mockUseAuth = vi.mocked(useAuth);

// TP1-06: the forbidden screen's "Request access" action is a mailto to the support/manager address (a
// client-only compose, no backend) prefilled with the requester and the page they hit. It must be a real
// link carrying the mailto scheme — not a next/link route, and not the old /settings placeholder.
describe("ForbiddenPage - Request access", () => {
  beforeEach(() => {
    from.mockReturnValue("/admins");
    mockUseAuth.mockReturnValue({
      user: { id: "u", email: "ada@example.test", role: "admin", status: "active", display_name: null },
      isAuthenticated: true,
    } as AuthState);
  });

  it("renders Request access as a mailto link to the support address with the requester and path", () => {
    render(<ForbiddenPage />);
    const link = screen.getByRole("link", { name: "Request access" });
    expect(link.tagName).toBe("A");
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("mailto:support@trackpoli.com?")).toBe(true);
    const body = new URLSearchParams(href.split("?")[1]).get("body") ?? "";
    expect(body).toContain("Requester: ada@example.test");
    expect(body).toContain("Attempted page: /admins");
  });

  it("falls back to a placeholder requester when there is no session email", () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false } as AuthState);
    from.mockReturnValue(null);
    render(<ForbiddenPage />);
    const href = screen.getByRole("link", { name: "Request access" }).getAttribute("href") ?? "";
    const body = new URLSearchParams(href.split("?")[1]).get("body") ?? "";
    expect(body).toContain("Requester: (not signed in)");
    expect(body).toContain("Attempted page: (not specified)");
  });
});

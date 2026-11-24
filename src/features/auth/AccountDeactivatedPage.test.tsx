import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/apiFetch";
import { AccountDeactivatedPage } from "./AccountDeactivatedPage";

vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockApiFetch = vi.mocked(apiFetch);

// TP1-09 follow-up: the account-deactivated screen replaces the old silent bounce-to-sign-in for a deactivated
// session. It must explain the removal, destroy the session on mount (best-effort sign-out — it both completes
// the ADR-0021 best-effort session-kill and is the OWASP "destroy the session, not just the cookie" move), and
// offer a way back to sign-in.
describe("AccountDeactivatedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue({ ok: true } as never);
  });

  it("explains that the account was deactivated by a manager", () => {
    render(<AccountDeactivatedPage />);
    expect(
      screen.getByRole("heading", { name: "Your administrator access has ended" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/deactivated this account/i)).toBeInTheDocument();
    expect(screen.getByText(/contact an Administrator manager/i)).toBeInTheDocument();
    // The footnote reassures that the political record is untouched.
    expect(screen.getByText(/nothing on the political record was changed/i)).toBeInTheDocument();
  });

  it("destroys the session on mount (best-effort sign-out)", () => {
    render(<AccountDeactivatedPage />);
    expect(mockApiFetch).toHaveBeenCalledWith("/admin/api/sign-out", { method: "POST" });
  });

  it("sends the administrator back to sign-in from the action, basePath-relative", () => {
    const assign = vi.fn();
    const original = window.location;
    // jsdom's window.location is not configurable by default; redefine it with a spied assign.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, assign },
    });
    try {
      render(<AccountDeactivatedPage />);
      screen.getByRole("button", { name: "Back to sign in" }).click();
      expect(assign).toHaveBeenCalledWith("/admin/sign-in");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });
});

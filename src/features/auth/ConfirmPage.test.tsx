import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/apiFetch";
import { ConfirmPage } from "./ConfirmPage";

// The shared /auth/confirm Continue page serves both recovery and invite links (TP1-09). These tests cover
// the invite branch added in TP1-09: the copy, and — crucially — that a successful exchange routes an invite
// to /accept-invite and a recovery to /reset-password.

vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockApiFetch = vi.mocked(apiFetch);
const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign, href: "http://localhost/" },
  });
});

describe("ConfirmPage — invite vs recovery", () => {
  it("shows the invite copy for an invite link", () => {
    render(<ConfirmPage tokenHash="tok" type="invite" />);
    expect(screen.getByRole("heading", { name: "Accept your invitation" })).toBeInTheDocument();
  });

  it("shows the recovery copy for a recovery link", () => {
    render(<ConfirmPage tokenHash="tok" type="recovery" />);
    expect(screen.getByRole("heading", { name: "Continue to reset password" })).toBeInTheDocument();
  });

  it("exchanges an invite token and routes to /accept-invite on success", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "ok" });
    render(<ConfirmPage tokenHash="tok" type="invite" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/admin/api/auth/confirm", {
        method: "POST",
        body: { tokenHash: "tok", type: "invite" },
      }),
    );
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/admin/accept-invite"));
  });

  it("routes a successful recovery exchange to /reset-password", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "ok" });
    render(<ConfirmPage tokenHash="tok" type="recovery" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/admin/reset-password"));
  });

  it("shows the invite link-expired state (no token) with a back-to-sign-in action, not request-a-link", () => {
    render(<ConfirmPage tokenHash={null} type="invite" />);
    expect(screen.getByRole("heading", { name: "This invitation has expired" })).toBeInTheDocument();
    // An invitation cannot be self-requested — the primary action returns to sign-in.
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(assign).toHaveBeenCalledWith("/admin/sign-in");
  });

  it("shows the expired state when an invite exchange reports expired", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "expired" });
    render(<ConfirmPage tokenHash="used" type="invite" />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "This invitation has expired" })).toBeInTheDocument(),
    );
  });
});

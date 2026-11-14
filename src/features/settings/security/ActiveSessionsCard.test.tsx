import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SnackbarProvider } from "@/components/ui/snackbar";
import { apiFetch } from "@/lib/apiFetch";
import { ActiveSessionsCard } from "./ActiveSessionsCard";

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

function renderCard() {
  return render(
    <SnackbarProvider>
      <ActiveSessionsCard />
    </SnackbarProvider>,
  );
}

describe("ActiveSessionsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the bulk sign-out row and the current-device marker", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Active sessions" })).toBeInTheDocument();
    expect(screen.getByText("This device")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out other sessions" })).toBeInTheDocument();
  });

  it("asks for confirmation before signing out, then announces success via the snackbar", async () => {
    mockApiFetch.mockResolvedValue({ ok: true } as never);
    renderCard();

    // The trigger opens a confirmation dialog; nothing is revoked until the user confirms.
    fireEvent.click(screen.getByRole("button", { name: "Sign out other sessions" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/ends every session except this one/i)).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out other sessions" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/admin/api/session/sign-out-others", { method: "POST" }),
    );
    expect(await screen.findByText("Signed out of your other sessions.")).toBeInTheDocument();
  });

  it("announces an error when the revoke fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("boom"));
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Sign out other sessions" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out other sessions" }));

    expect(
      await screen.findByText("We couldn't sign out the other sessions. Please try again."),
    ).toBeInTheDocument();
  });
});

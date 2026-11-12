import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/apiFetch";
import { AcceptInvitePage } from "./AcceptInvitePage";

vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockApiFetch = vi.mocked(apiFetch);
const LONG = "correct-horse-battery-staple"; // >= 12 chars
const EMAIL = "amara.nwosu@trackpoli.org";

describe("AcceptInvitePage (TP1-09, shadcn)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the invite activation form from the sign-in design, adapted", () => {
    render(<AcceptInvitePage email={EMAIL} />);
    expect(screen.getByRole("heading", { name: "Accept your invitation" })).toBeInTheDocument();
    expect(screen.getByLabelText("Create a password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activate account" })).toBeInTheDocument();
    // The invited email is shown with the person, in the audit footnote.
    expect(screen.getByText(new RegExp(`This invitation is for ${EMAIL}`))).toBeInTheDocument();
  });

  it("fixes the email to the invited address (read-only, not editable)", () => {
    render(<AcceptInvitePage email={EMAIL} />);
    const field = screen.getByLabelText("Email") as HTMLInputElement;
    expect(field.value).toBe(EMAIL);
    expect(field).toHaveAttribute("readonly");
  });

  it("keeps Activate disabled until the password meets length and the two match", () => {
    render(<AcceptInvitePage email={EMAIL} />);
    const activate = screen.getByRole("button", { name: "Activate account" });
    expect(activate).toBeDisabled();

    // Too short: still disabled.
    fireEvent.change(screen.getByLabelText("Create a password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "short" } });
    expect(activate).toBeDisabled();

    // Long enough and matching: enabled.
    fireEvent.change(screen.getByLabelText("Create a password"), { target: { value: LONG } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: LONG } });
    expect(activate).toBeEnabled();
  });

  it("shows the mismatch helper and marks the confirm field invalid when the two differ", () => {
    render(<AcceptInvitePage email={EMAIL} />);
    fireEvent.change(screen.getByLabelText("Create a password"), { target: { value: LONG } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: LONG + "x" } });
    expect(screen.getByText("Both passwords must match.")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Activate account" })).toBeDisabled();
  });

  it("toggles the create-password visibility (native, keyboard-operable control)", () => {
    render(<AcceptInvitePage email={EMAIL} />);
    const field = screen.getByLabelText("Create a password") as HTMLInputElement;
    expect(field.type).toBe("password");
    fireEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    expect(field.type).toBe("text");
  });

  it("submits the password to the accept-invite route when valid", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "weak_password" }); // non-redirect outcome keeps the DOM
    render(<AcceptInvitePage email={EMAIL} />);
    fireEvent.change(screen.getByLabelText("Create a password"), { target: { value: LONG } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: LONG } });
    fireEvent.click(screen.getByRole("button", { name: "Activate account" }));
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/admin/api/accept-invite", {
        method: "POST",
        body: { password: LONG },
      }),
    );
  });

  it("surfaces the link-expired notice when the invite session is gone", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "no_session" });
    render(<AcceptInvitePage email={EMAIL} />);
    fireEvent.change(screen.getByLabelText("Create a password"), { target: { value: LONG } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: LONG } });
    fireEvent.click(screen.getByRole("button", { name: "Activate account" }));
    await waitFor(() =>
      expect(screen.getByText(/invitation link is invalid or has expired/i)).toBeInTheDocument(),
    );
  });
});

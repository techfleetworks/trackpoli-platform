import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/apiFetch";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockApiFetch = vi.mocked(apiFetch);

describe("ForgotPasswordPage (shadcn migration)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the request form with the design-system input, label and button", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
  });

  // Regression guard (WCAG 4.1.2 Name, Role, Value): the <form> must carry an accessible name, so it is
  // exposed as a named "form" landmark and the error alert can be scoped to it. A <form> with no name is
  // NOT given the implicit form role, so this fails if aria-labelledby is dropped.
  it("exposes the request form as a named landmark 'Reset your password'", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("form", { name: "Reset your password" })).toBeInTheDocument();
  });

  it("shows the enumeration-safe sent screen on a successful request (parity)", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "sent" });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "amara@trackpoli.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    // On success the request form is replaced by the "check your email" screen.
    await waitFor(() => expect(screen.queryByLabelText("Email")).not.toBeInTheDocument());
  });

  it("announces the generic notice via role=alert when blocked", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "blocked", reason: "rate_limited" });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "amara@trackpoli.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});

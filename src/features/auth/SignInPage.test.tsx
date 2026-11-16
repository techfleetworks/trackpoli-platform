import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/apiFetch";
import { SignInPage } from "./SignInPage";

vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockApiFetch = vi.mocked(apiFetch);

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "amara@trackpoli.org" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-battery" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sign-in form", () => {
    render(<SignInPage />);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });

  // Regression guard (WCAG 4.1.2 Name, Role, Value): the <form> must carry an accessible name, so it is
  // exposed as a named "form" landmark and the error alert can be scoped to it. A <form> with no name is
  // NOT given the implicit form role, so this fails if aria-labelledby is dropped (as the ADR-0028 migration
  // did when it placed the label on the AuthCard div instead of the form).
  it("exposes the sign-in form as a named landmark 'Sign in'", () => {
    render(<SignInPage />);
    expect(screen.getByRole("form", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the generic error and the remaining-attempts helper on a failed outcome", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "failed", attemptsRemaining: 2 });
    render(<SignInPage />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("The email or password you entered is incorrect."),
    );
    expect(
      screen.getByText("2 attempts remaining before this account is temporarily locked."),
    ).toBeInTheDocument();
  });

  it("switches to the locked view on a locked outcome", async () => {
    mockApiFetch.mockResolvedValue({
      outcome: "locked",
      lockedUntil: new Date(Date.now() + 15 * 60000).toISOString(),
    });
    render(<SignInPage />);
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Account temporarily locked" })).toBeInTheDocument(),
    );
    expect(screen.getByText(/You can try signing in again in 15 minutes\./)).toBeInTheDocument();
  });

  it("toggles password visibility", () => {
    render(<SignInPage />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.type).toBe("text");
  });
});

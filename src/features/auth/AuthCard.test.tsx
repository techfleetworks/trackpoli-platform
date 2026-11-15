import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { AuthCard, AuthCardFooter } from "./AuthCard";

// ADR-0028: the shared auth card shell on the design-system Card primitive. Pins the contract the 9 auth
// screens rely on — the brand lockup, the labelled card surface from tokens (not a hardcoded colour), the
// centred-brand option, and the footer note.
describe("AuthCard", () => {
  it("renders the brand lockup and children inside a labelled card", () => {
    render(
      <AuthCard aria-labelledby="t">
        <h1 id="t">Sign in</h1>
      </AuthCard>,
    );
    expect(screen.getByText("TrackPoli Admin")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("uses the semantic card surface utility, not a colour literal", () => {
    const { container } = render(
      <AuthCard aria-labelledby="t">
        <h1 id="t">X</h1>
      </AuthCard>,
    );
    const card = container.querySelector('[data-slot="card"]');
    expect(card?.className).toContain("bg-card");
  });

  it("centres the brand when brandCentered is set", () => {
    render(
      <AuthCard brandCentered>
        <span>content</span>
      </AuthCard>,
    );
    expect(screen.getByText("TrackPoli Admin").parentElement?.className).toContain("justify-center");
  });

  it("renders a centred footer note", () => {
    render(<AuthCardFooter>Invitation only</AuthCardFooter>);
    expect(screen.getByText("Invitation only").className).toContain("text-center");
  });
});

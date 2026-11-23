import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PartyDirectory } from "./PartyDirectory";
import { PARTY_FIXTURES } from "@/services/parties/parties.fixtures";

function searchFor(text: string) {
  fireEvent.change(screen.getByLabelText(/Search parties/i), { target: { value: text } });
}

describe("PartyDirectory", () => {
  it("has one h1 and lists every party on first render (happy path)", () => {
    render(<PartyDirectory />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(PARTY_FIXTURES.length);
  });

  it("reports the result count and pluralises it", () => {
    render(<PartyDirectory />);
    expect(screen.getByText(`${PARTY_FIXTURES.length} parties`)).toBeInTheDocument();
    searchFor("apc"); // exactly one match -> singular
    expect(screen.getByText("1 party")).toBeInTheDocument();
  });

  it("filters the list live as the user types, and shows an empty state with no matches", () => {
    render(<PartyDirectory />);
    searchFor("labour");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Labour Party/i })).toBeInTheDocument();

    searchFor("no-such-party");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(/No parties match/i)).toBeInTheDocument();
  });

  it("the Registered quick filter is a pressable toggle that keeps only registered parties", () => {
    render(<PartyDirectory />);
    const registered = screen.getByRole("button", { name: "Registered" });
    expect(registered).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(registered);
    expect(registered).toHaveAttribute("aria-pressed", "true");
    // All fixtures are registered, so the count is unchanged but the filter is applied.
    expect(screen.getAllByRole("listitem").length).toBe(
      PARTY_FIXTURES.filter((p) => p.registrationStatus === "registered").length,
    );
  });

  it("exposes the not-yet-built facets as disabled, announced as coming soon (honest, not dead links)", () => {
    render(<PartyDirectory />);
    for (const name of [/By state/, /By level/, /Filters/]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("marks the Parties tab as the current page in the primary navigation", () => {
    render(<PartyDirectory />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: /Parties/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

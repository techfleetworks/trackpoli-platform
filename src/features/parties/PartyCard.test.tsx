import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PartyCard } from "./PartyCard";
import type { Party } from "@/services/parties/partyTypes";

const apc: Party = {
  slug: "apc",
  abbreviation: "APC",
  name: "All Progressives Congress",
  symbol: "Broom",
  foundedYear: 2013,
  level: "national",
  registrationStatus: "registered",
  sourceStatus: "inec-verified",
  statePresence: "all",
};

describe("PartyCard", () => {
  it("is a single link to the party profile (whole row, not a chevron-only target)", () => {
    render(<PartyCard party={apc} />);
    const link = screen.getByRole("link", { name: /All Progressives Congress/i });
    expect(link).toHaveAttribute("href", "/app/parties/apc");
  });

  it("shows the name, the joined meta line, and the status as text (not colour-only)", () => {
    render(<PartyCard party={apc} />);
    expect(screen.getByText("All Progressives Congress")).toBeInTheDocument();
    expect(screen.getByText("APC · Broom · Est. 2013")).toBeInTheDocument();
    expect(screen.getByText("Registered")).toBeInTheDocument();
    expect(screen.getByText("INEC verified")).toBeInTheDocument();
  });

  it("omits an absent symbol from the meta line and reports a pending source as text", () => {
    render(
      <PartyCard
        party={{ ...apc, slug: "lp", abbreviation: "LP", name: "Labour Party", symbol: undefined, sourceStatus: "update-pending" }}
      />,
    );
    expect(screen.getByText("LP · Est. 2013")).toBeInTheDocument();
    expect(screen.getByText("Update pending")).toBeInTheDocument();
  });
});

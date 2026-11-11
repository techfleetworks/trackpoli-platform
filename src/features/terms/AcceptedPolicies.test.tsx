import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { AcceptedPolicies } from "./AcceptedPolicies";

describe("AcceptedPolicies", () => {
  it("lists each acceptance with its document, version and formatted time", () => {
    render(
      <AcceptedPolicies
        acceptances={[
          { document: "terms", version: "0", acceptedAt: "2026-11-11T09:30:00.000Z" },
          { document: "privacy", version: "0", acceptedAt: "2026-11-11T09:30:00.000Z" },
        ]}
      />,
    );
    expect(screen.getByText("Terms of use · Version 0")).toBeInTheDocument();
    expect(screen.getByText("Privacy notice · Version 0")).toBeInTheDocument();
    // Day-month-year per the en-GB formatter (TP1-07 formatDate); the exact time is locale/zone formatted.
    expect(screen.getAllByText(/Accepted .*2026/)).toHaveLength(2);
  });

  it("shows an empty state when there are no acceptances", () => {
    render(<AcceptedPolicies acceptances={[]} />);
    expect(screen.getByText("No acceptances recorded yet.")).toBeInTheDocument();
  });

  it("has no edit or delete control — the record is immutable consent evidence", () => {
    render(
      <AcceptedPolicies acceptances={[{ document: "terms", version: "0", acceptedAt: "2026-11-11T09:30:00.000Z" }]} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

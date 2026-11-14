import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

describe("Switch", () => {
  it("exposes the switch role, unchecked by default, and toggles on click", () => {
    render(<Switch aria-label="Reduce motion" />);
    const sw = screen.getByRole("switch", { name: "Reduce motion" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("associates with a <Label htmlFor> so the label names the control", () => {
    render(
      <>
        <Label htmlFor="pref-x">Compact tables</Label>
        <Switch id="pref-x" />
      </>,
    );
    expect(screen.getByRole("switch", { name: "Compact tables" })).toBeInTheDocument();
  });

  it("is disabled and does not toggle when disabled (the layout-only state)", () => {
    render(<Switch aria-label="Security alerts" defaultChecked disabled />);
    const sw = screen.getByRole("switch", { name: "Security alerts" });
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    // A disabled switch never changes state, so a silent discard is impossible.
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

describe("Checkbox", () => {
  it("renders a labelled checkbox control with aria-checked", () => {
    render(
      <div>
        <Checkbox id="agree" />
        <Label htmlFor="agree">I agree</Label>
      </div>,
    );
    const box = screen.getByRole("checkbox", { name: "I agree" });
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("toggles checked state and calls onCheckedChange on click", () => {
    const onCheckedChange = vi.fn();
    render(
      <div>
        <Checkbox id="agree" onCheckedChange={onCheckedChange} />
        <Label htmlFor="agree">I agree</Label>
      </div>,
    );
    const box = screen.getByRole("checkbox", { name: "I agree" });
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(box).toHaveAttribute("aria-checked", "true");
  });

  it("reflects a controlled checked prop", () => {
    render(<Checkbox checked aria-label="Controlled" />);
    expect(screen.getByRole("checkbox", { name: "Controlled" })).toHaveAttribute("aria-checked", "true");
  });

  it("is keyboard-operable: a native-equivalent focusable control kept in the tab order", () => {
    render(<Checkbox aria-label="Code" />);
    const box = screen.getByRole("checkbox", { name: "Code" });
    // Radix renders a real <button role="checkbox"> that Space toggles natively; it must stay focusable
    // and in the tab order (no tabindex="-1"), the same keyboard contract the OtpField/NavItem tests assert.
    expect(box.tagName).toBe("BUTTON");
    expect(box).not.toHaveAttribute("tabindex", "-1");
    box.focus();
    expect(box).toHaveFocus();
  });

  it("does not toggle when disabled", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="Off" disabled onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Off" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

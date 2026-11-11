import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function Fixture() {
  return (
    <Tabs defaultValue="terms">
      <TabsList aria-label="Documents">
        <TabsTrigger value="terms">Terms of use</TabsTrigger>
        <TabsTrigger value="privacy">Privacy notice</TabsTrigger>
      </TabsList>
      <TabsContent value="terms">Terms body</TabsContent>
      <TabsContent value="privacy">Privacy body</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("exposes the tablist/tab/tabpanel roles with the default tab selected", () => {
    render(<Fixture />);
    expect(screen.getByRole("tablist", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Terms of use" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Privacy notice" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Terms body");
  });

  it("switches the panel when another tab is activated (automatic activation on focus)", () => {
    render(<Fixture />);
    const privacy = screen.getByRole("tab", { name: "Privacy notice" });
    // Radix Tabs use automatic activation: focusing a tab selects it (WAI-ARIA automatic tabs pattern).
    fireEvent.focus(privacy);
    expect(privacy).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Privacy body");
  });

  it("is keyboard-operable: tabs are focusable and selection follows keyboard focus", () => {
    render(<Fixture />);
    const terms = screen.getByRole("tab", { name: "Terms of use" });
    const privacy = screen.getByRole("tab", { name: "Privacy notice" });
    // Both are native focusable <button> tabs; in the automatic-activation pattern a keyboard user who
    // moves focus between them (Tab into the list, then arrow) selects the focused tab.
    expect(terms.tagName).toBe("BUTTON");
    terms.focus();
    expect(terms).toHaveFocus();
    fireEvent.focus(privacy);
    expect(privacy).toHaveAttribute("aria-selected", "true");
    expect(terms).toHaveAttribute("aria-selected", "false");
  });
});

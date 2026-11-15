import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Button } from "./button";
import { Card, CardHeader, CardTitle, CardDescription, CardImage } from "./card";
import { Toast, ToastTitle, ToastDescription } from "./toast";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "./hover-card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";

// ADR-0027 custom variants. Pins the design-system contract: colour variants apply the right palette
// utility, the toast icon sits before the header and the toast announces via role=status, the hover card
// exposes content on open, the table keeps semantic roles incl. an Actions column, and Button disabled
// works at every size.

describe("Card colour variants (Figma Card matrix)", () => {
  it("applies the Pine surface + Mist text utilities", () => {
    render(
      <Card color="pine" data-testid="c">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
      </Card>,
    );
    const el = screen.getByTestId("c");
    expect(el.className).toContain("bg-pine");
    expect(el.className).toContain("text-mist");
    expect(screen.getByText("Title")).toBeInTheDocument();
  });
  it("defaults to the semantic card surface", () => {
    render(<Card data-testid="c" />);
    expect(screen.getByTestId("c").className).toContain("bg-card");
  });
  it("renders a photo (CardImage) with an empty alt when decorative", () => {
    render(<CardImage src="/x.jpg" data-testid="img" />);
    expect(screen.getByTestId("img")).toHaveAttribute("alt", "");
  });
});

describe("Toast colour variants", () => {
  it("announces via role=status and places the icon before the header", () => {
    render(
      <Toast variant="coral" icon={<svg data-testid="icon" />}>
        <ToastTitle>Heads up</ToastTitle>
        <ToastDescription>Something happened</ToastDescription>
      </Toast>,
    );
    const toast = screen.getByRole("status");
    expect(toast.className).toContain("bg-coral");
    // Icon is the first child, i.e. to the left of the header column.
    expect(toast.firstElementChild).toContainElement(screen.getByTestId("icon"));
    expect(screen.getByText("Heads up")).toBeInTheDocument();
  });
});

describe("Hover card", () => {
  it("shows coloured content when open", () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>@trigger</HoverCardTrigger>
        <HoverCardContent color="slate">Profile</HoverCardContent>
      </HoverCard>,
    );
    const content = screen.getByText("Profile");
    expect(content.className).toContain("bg-slate");
    expect(content.className).toContain("text-mist");
  });
});

describe("Table with an Actions column", () => {
  it("keeps semantic table roles and renders a ghost action button", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada Okafor</TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <svg />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Row actions" })).toBeInTheDocument();
  });
});

describe("Button disabled works at every size", () => {
  for (const size of ["default", "sm", "icon", "inline"] as const) {
    it(`size=${size} renders a disabled control`, () => {
      render(
        <Button size={size} disabled aria-label={`b-${size}`}>
          x
        </Button>,
      );
      const btn = screen.getByRole("button", { name: `b-${size}` });
      expect(btn).toBeDisabled();
      expect(btn.className).toContain("disabled:opacity-60");
    });
  }
});

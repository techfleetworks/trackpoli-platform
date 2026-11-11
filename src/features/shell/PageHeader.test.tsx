import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PageHeader } from "@/features/shell/PageHeader";

describe("PageHeader", () => {
  it("renders the title as the page's single h1", () => {
    render(<PageHeader title="Politicians" />);
    const heading = screen.getByRole("heading", { level: 1, name: "Politicians" });
    expect(heading).toBeInTheDocument();
  });

  it("renders the actions cluster when provided", () => {
    render(<PageHeader title="Politicians" actions={<button type="button">New record</button>} />);
    expect(screen.getByRole("button", { name: "New record" })).toBeInTheDocument();
  });

  it("renders a breadcrumb nav with links and a current page", () => {
    render(
      <PageHeader
        title="Billing"
        breadcrumbs={[
          { label: "Admin management", href: "/admin/admins" },
          { label: "Billing" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin management" })).toHaveAttribute("href", "/admin/admins");
    // The last crumb has no link and is marked as the current page.
    expect(screen.getByText("Billing", { selector: "[aria-current='page']" })).toBeInTheDocument();
  });

  it("omits the breadcrumb nav when none is given", () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });
});

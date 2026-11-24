import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorScreen } from "./ErrorScreen";
import forbiddenIcon from "./assets/forbidden.svg";

// Shell design-system migration (TP1-06 ErrorState -> TP1-07 ErrorScreen on shadcn/Tailwind): the error
// action that has an onClick (no href) must render as the shadcn Button (a native <button>) with its label
// and click behaviour; the href action stays a next/link. Parity with the pre-migration raw <button>.
describe("ErrorScreen - shell shadcn migration parity", () => {
  it("renders an onClick action as a native shadcn <button> that fires", () => {
    const onClick = vi.fn();
    render(
      <ErrorScreen icon={forbiddenIcon} title="No access" body="b" code="403" primary={{ label: "Try again", onClick }} />,
    );
    const btn = screen.getByRole("button", { name: "Try again" });
    expect(btn.tagName).toBe("BUTTON");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders an href action as a link, not a button (basePath-relative, ADR-0014)", () => {
    render(
      <ErrorScreen
        icon={forbiddenIcon}
        title="No access"
        body="b"
        code="403"
        primary={{ label: "Back to dashboard", href: "/" }}
        secondary={{ label: "Settings", href: "/settings" }}
      />,
    );
    const link = screen.getByRole("link", { name: "Back to dashboard" });
    expect(link.tagName).toBe("A");
    // The href is basePath-relative (passed through to next/link); never the doubled /admin/admin.
    expect(link.getAttribute("href") ?? "").not.toContain("/admin/admin");
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  // TP1-06: a scheme href (mailto:/tel:/external) is a real navigation, not an app route — it must render as
  // a plain <a> carrying the scheme verbatim (never through next/link, which would prepend the basePath).
  it("renders a mailto scheme href as a plain anchor with the scheme intact", () => {
    render(
      <ErrorScreen
        icon={forbiddenIcon}
        title="No access"
        body="b"
        code="403"
        primary={{ label: "Back to dashboard", href: "/" }}
        secondary={{ label: "Request access", href: "mailto:support@trackpoli.com?subject=Hi" }}
      />,
    );
    const link = screen.getByRole("link", { name: "Request access" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("mailto:support@trackpoli.com?subject=Hi");
    expect(link.getAttribute("href")).not.toContain("/admin");
  });
});

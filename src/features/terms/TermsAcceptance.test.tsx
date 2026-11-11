import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TermsAcceptance, type TermsPolicyView } from "./TermsAcceptance";

// Mock the record hook so the screen's submit path is observable without a real network call or navigation.
const submit = vi.fn();
vi.mock("./useRecordTerms", () => ({
  useRecordTerms: () => ({ submitting: false, submit }),
}));

const POLICIES: TermsPolicyView[] = [
  { document: "terms", label: "Terms of use", version: "0", isPlaceholder: true, body: "Terms body (version 0)" },
  { document: "privacy", label: "Privacy notice", version: "0", isPlaceholder: true, body: "Privacy body (version 0)" },
];

describe("TermsAcceptance", () => {
  beforeEach(() => {
    submit.mockReset();
  });

  it("renders the heading, both document tabs, the version row and the active document", () => {
    render(<TermsAcceptance policies={POLICIES} />);
    expect(screen.getByRole("heading", { level: 1, name: "Terms and privacy notice" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Terms of use" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Privacy notice" })).toBeInTheDocument();
    expect(screen.getByText("Terms of use · Version 0 · Placeholder text")).toBeInTheDocument();
    expect(screen.getByText("Terms body (version 0)")).toBeInTheDocument();
  });

  it("exposes the document body as a labelled, keyboard-focusable region (a11y)", () => {
    render(<TermsAcceptance policies={POLICIES} />);
    const region = screen.getByRole("region", { name: "Terms of use, version 0" });
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("gates the Accept button behind the checkbox (affirmative consent)", () => {
    render(<TermsAcceptance policies={POLICIES} />);
    const accept = screen.getByRole("button", { name: "Accept and continue" });
    expect(accept).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read and agree/i }));
    expect(accept).toBeEnabled();
  });

  it("submits the current versions of both documents when accepted", async () => {
    submit.mockResolvedValue("error"); // stay on the page (no navigation) so we can assert the call
    render(<TermsAcceptance policies={POLICIES} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read and agree/i }));
    fireEvent.click(screen.getByRole("button", { name: "Accept and continue" }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith([
        { document: "terms", version: "0" },
        { document: "privacy", version: "0" },
      ]),
    );
  });

  it("shows the retryable error banner when the save fails", async () => {
    submit.mockResolvedValue("error");
    render(<TermsAcceptance policies={POLICIES} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read and agree/i }));
    fireEvent.click(screen.getByRole("button", { name: "Accept and continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't save your acceptance/i);
  });

  it("switches to the privacy document when its tab is focused", () => {
    render(<TermsAcceptance policies={POLICIES} />);
    fireEvent.focus(screen.getByRole("tab", { name: "Privacy notice" }));
    expect(screen.getByRole("region", { name: "Privacy notice, version 0" })).toBeInTheDocument();
  });

  it("shows the re-acceptance heading and what-changed note for the reaccept variant", () => {
    render(<TermsAcceptance policies={POLICIES} variant="reaccept" />);
    expect(screen.getByRole("heading", { level: 1, name: "We've updated our terms" })).toBeInTheDocument();
    expect(screen.getByText("What's changed")).toBeInTheDocument();
  });

  it("shows the 'new version published' banner when staleBanner is set", () => {
    render(<TermsAcceptance policies={POLICIES} staleBanner />);
    expect(screen.getByRole("alert")).toHaveTextContent(/terms were updated while you were reading/i);
  });
});

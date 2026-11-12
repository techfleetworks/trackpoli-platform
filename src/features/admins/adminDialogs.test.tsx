import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// The dialogs call useAdminAction() internally; mock it so the tests drive the edge result and assert the
// branching (field errors, the last-manager flow, success) without any network. `run` is reset per test.
const run = vi.fn();
vi.mock("./useAdminAction", () => ({ useAdminAction: () => ({ run, pending: false }) }));

import { ChangeEmailDialog } from "./ChangeEmailDialog";
import { RecreateAccountDialog } from "./RecreateAccountDialog";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { ChangeRoleDialog } from "./ChangeRoleDialog";
import type { AdminRow } from "./adminTypes";

const admin: AdminRow = {
  id: "a1",
  email: "funmi@trackpoli.org",
  displayName: "Funmi Adebayo",
  role: "admin",
  status: "active",
  lastSignInAt: null,
  createdAt: "2026-03-03T00:00:00Z",
};

beforeEach(() => {
  run.mockReset();
});

describe("ChangeEmailDialog", () => {
  const noop = () => {};

  it("rejects an invalid email on the field without calling the action", async () => {
    render(<ChangeEmailDialog admin={admin} open onOpenChange={noop} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects the current address as unchanged", async () => {
    render(<ChangeEmailDialog admin={admin} open onOpenChange={noop} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "FUNMI@trackpoli.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(await screen.findByText("That is already this administrator's email.")).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it("surfaces a server email_in_use on the field, and sends a normalised payload", async () => {
    run.mockResolvedValue({ ok: false, code: "email_in_use", message: "x" });
    render(<ChangeEmailDialog admin={admin} open onOpenChange={noop} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "  New@TrackPoli.org " } });
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    expect(await screen.findByText("Another administrator already uses that email.")).toBeInTheDocument();
    expect(run).toHaveBeenCalledWith("change-email", { admin_id: "a1", new_email: "new@trackpoli.org" });
  });

  it("calls onDone with the success toast on success", async () => {
    run.mockResolvedValue({ ok: true, data: {} });
    const onDone = vi.fn();
    render(<ChangeEmailDialog admin={admin} open onOpenChange={noop} onDone={onDone} />);
    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "new@trackpoli.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith("Funmi Adebayo's email was changed."));
  });
});

describe("RecreateAccountDialog", () => {
  const noop = () => {};

  it("keeps the destructive primary disabled until the typed email matches", () => {
    render(
      <RecreateAccountDialog admin={admin} open onOpenChange={noop} onDone={vi.fn()} onBlockedLastManager={vi.fn()} />,
    );
    const button = screen.getByRole("button", { name: "Recreate account" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type their email to confirm"), {
      target: { value: "Funmi@trackpoli.org" },
    });
    expect(button).toBeEnabled();
  });

  it("opens the last-manager flow when the guard refuses", async () => {
    run.mockResolvedValue({ ok: false, code: "last_manager", message: "x" });
    const onBlocked = vi.fn();
    render(
      <RecreateAccountDialog admin={admin} open onOpenChange={noop} onDone={vi.fn()} onBlockedLastManager={onBlocked} />,
    );
    fireEvent.change(screen.getByLabelText("Type their email to confirm"), {
      target: { value: "funmi@trackpoli.org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Recreate account" }));
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalledOnce());
  });
});

describe("ConfirmActionDialog (deactivate)", () => {
  const noop = () => {};
  function renderDeactivate(overrides: Partial<React.ComponentProps<typeof ConfirmActionDialog>> = {}) {
    return render(
      <ConfirmActionDialog
        admin={admin}
        open
        onOpenChange={noop}
        action="deactivate"
        title="Deactivate Funmi Adebayo?"
        body="They can no longer sign in."
        whatNext="Their records stay."
        submitLabel="Deactivate"
        pendingLabel="Deactivating…"
        destructive
        successMessage="Funmi Adebayo was deactivated."
        onDone={vi.fn()}
        onBlockedLastManager={vi.fn()}
        {...overrides}
      />,
    );
  }

  it("routes a last_manager result to the blocked dialog, not an inline error", async () => {
    run.mockResolvedValue({ ok: false, code: "last_manager", message: "x" });
    const onBlocked = vi.fn();
    renderDeactivate({ onBlockedLastManager: onBlocked });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalledOnce());
  });

  it("calls onDone with the success toast on success", async () => {
    run.mockResolvedValue({ ok: true, data: {} });
    const onDone = vi.fn();
    renderDeactivate({ onDone });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith("Funmi Adebayo was deactivated."));
  });
});

describe("ChangeRoleDialog", () => {
  it("disables the primary while the selected role is unchanged", () => {
    render(
      <ChangeRoleDialog admin={admin} open onOpenChange={() => {}} onDone={vi.fn()} onBlockedLastManager={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Change role" })).toBeDisabled();
    expect(run).not.toHaveBeenCalled();
  });
});

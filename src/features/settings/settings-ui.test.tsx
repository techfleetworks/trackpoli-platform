import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SnackbarProvider } from "@/components/ui/snackbar";
import { YourRoleCard } from "@/features/settings/YourRoleCard";
import { ProfileTab } from "@/features/settings/profile/ProfileTab";
import { SettingsTabs } from "@/features/settings/SettingsTabs";
import type { ProfileDetails } from "@/features/settings/profile/profileData";
import type { AcceptedPolicy } from "@/features/terms/AcceptedPolicies";
import type { TwoFactorStatus } from "@/features/settings/security/twoFactor";
import { apiFetch } from "@/lib/apiFetch";

// The change-password/display-name dialogs reach the server through apiFetch; mock it so the edit flow is
// exercised without a network. SettingsTabs statically pulls in the Security cards (which import ApiError),
// so the mock exports it too.
vi.mock("@/lib/apiFetch", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockApiFetch = vi.mocked(apiFetch);

const PROFILE: ProfileDetails = {
  displayName: "Amara Nwosu",
  createdAt: "2026-01-02T10:00:00Z",
  lastSignInAt: "2026-11-01T08:30:00Z",
};
const ACCEPTANCES: AcceptedPolicy[] = [{ document: "terms", version: "0", acceptedAt: "2026-01-03T09:00:00Z" }];
const STATUS: TwoFactorStatus = { enrolled: true, accountType: "password", isManager: false };

function withSnackbar(ui: React.ReactNode) {
  return render(<SnackbarProvider>{ui}</SnackbarProvider>);
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

describe("YourRoleCard", () => {
  it("lists manager capabilities for an Administrator Manager", () => {
    render(<YourRoleCard role="admin_manager" />);
    expect(screen.getByText("Administrator manager")).toBeInTheDocument();
    expect(screen.getByText("Invite and manage other administrators")).toBeInTheDocument();
  });

  it("shows the administrator role without the manager-only capability", () => {
    render(<YourRoleCard role="admin" />);
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.queryByText("Invite and manage other administrators")).not.toBeInTheDocument();
  });

  it("falls back gracefully when the role is unreadable", () => {
    render(<YourRoleCard role={null} />);
    expect(screen.getByText(/Your role could not be read/)).toBeInTheDocument();
  });
});

describe("ProfileTab", () => {
  it("shows the administrator's details and the accepted-policies list", () => {
    withSnackbar(<ProfileTab email="amara@example.com" initial={PROFILE} acceptances={ACCEPTANCES} />);
    expect(screen.getByText("Amara Nwosu")).toBeInTheDocument();
    expect(screen.getByText("amara@example.com")).toBeInTheDocument();
    expect(screen.getByText("Policies you've accepted")).toBeInTheDocument();
    expect(screen.getByText(/Terms of use/)).toBeInTheDocument();
  });

  it("renders an error state rather than an edit form when the profile is unreadable", () => {
    withSnackbar(<ProfileTab email="amara@example.com" initial={null} acceptances={[]} />);
    expect(screen.getByText("Profile unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("saves a new display name through the display-name endpoint and returns to view mode", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "done", displayName: "Amara O. Nwosu" });
    withSnackbar(<ProfileTab email="amara@example.com" initial={PROFILE} acceptances={ACCEPTANCES} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Amara O. Nwosu" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/admin/api/settings/display-name", {
        method: "POST",
        body: { displayName: "Amara O. Nwosu" },
      }),
    );
    await waitFor(() => expect(screen.getByText("Amara O. Nwosu")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("surfaces a server-rejected name as a field error and stays in edit mode", async () => {
    mockApiFetch.mockResolvedValue({ outcome: "invalid" });
    withSnackbar(<ProfileTab email="amara@example.com" initial={PROFILE} acceptances={ACCEPTANCES} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Robert" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("Enter a name of 1 to 120 characters.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});

describe("SettingsTabs role-aware shell", () => {
  it("shows the Workspace rules tab to a manager", () => {
    withSnackbar(
      <SettingsTabs
        role="admin_manager"
        email="amara@example.com"
        profile={PROFILE}
        acceptances={ACCEPTANCES}
        twoFactor={STATUS}
        initialTab="profile"
      />,
    );
    expect(screen.getByRole("tab", { name: "Workspace rules" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
  });

  it("hides the Workspace rules tab from a plain administrator", () => {
    withSnackbar(
      <SettingsTabs
        role="admin"
        email="amara@example.com"
        profile={PROFILE}
        acceptances={ACCEPTANCES}
        twoFactor={STATUS}
        initialTab="profile"
      />,
    );
    expect(screen.queryByRole("tab", { name: "Workspace rules" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Security" })).toBeInTheDocument();
  });
});

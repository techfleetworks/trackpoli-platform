import { SettingsCard } from "./SettingsCard";
import { roleLabel, type AdminRole } from "@/lib/roles";

// The persistent "Your role" card (TP1-11, P1-14) shown beside the Settings tabs. It states the signed-in
// administrator's role and the capabilities it carries, so a user understands what they can and cannot do.
// This is RENDERING only, never an access decision — the database (RLS) is the authorization boundary
// (ADR-0012); a wrong role shown here is a cosmetic bug, never an exposure. The capability copy describes
// only functionality that exists in this phase (profile/security for everyone; administrator management for
// managers), so it never promises a control the console does not yet have (usability: honest affordances).

const CAPABILITIES: Record<AdminRole, readonly string[]> = {
  admin: [
    "Manage your own profile and display name",
    "Change your password and your two-factor device",
    "Sign out your other sessions",
  ],
  admin_manager: [
    "Everything an administrator can do",
    "Invite and manage other administrators",
    "Change an administrator's role, email or status",
    "Recreate an administrator who has lost their device",
  ],
};

const bodyMedium =
  "text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)]";
const bodySmall =
  "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

export function YourRoleCard({ role }: { role: AdminRole | null }) {
  const capabilities = role ? CAPABILITIES[role] : [];
  return (
    <SettingsCard title="Your role" titleId="your-role-title">
      <p className={`${bodyMedium} font-medium text-foreground`}>{roleLabel(role)}</p>
      {capabilities.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {capabilities.map((capability) => (
            <li key={capability} className={`${bodySmall} text-muted-foreground`}>
              {capability}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`${bodySmall} text-muted-foreground`}>
          Your role could not be read. Sign out and back in if this persists.
        </p>
      )}
    </SettingsCard>
  );
}

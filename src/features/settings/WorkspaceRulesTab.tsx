import { SettingsCard } from "./SettingsCard";
import { SettingsToggleRow } from "./SettingsToggleRow";
import { ComingSoonNote } from "./ComingSoonNote";

// The Workspace rules settings tab (TP1-11, P1-14), shown ONLY to an Admin manager (the Settings shell omits
// the tab entirely for a plain administrator — rendering is role-aware, authorization stays with RLS,
// ADR-0012). LAYOUT ONLY this phase: it previews the workspace-wide policy controls a manager will eventually
// set but persists nothing, so every control is disabled and a banner says so. Presentation only — no data
// access, no state.

export function WorkspaceRulesTab() {
  return (
    <div className="flex flex-col gap-6">
      <ComingSoonNote>
        Workspace rules aren&apos;t active yet. This is a preview of the controls managers will have —
        nothing here is saved, and it changes nothing for the team.
      </ComingSoonNote>
      <SettingsCard
        title="Administrator security"
        titleId="workspace-security-title"
        subtitle="Workspace-wide rules that apply to every administrator."
      >
        <div className="flex flex-col">
          <SettingsToggleRow
            id="ws-require-2fa"
            label="Require two-factor for all administrators"
            description="Every administrator must enrol a two-factor device before using the console."
            defaultChecked
          />
          <SettingsToggleRow
            id="ws-session-timeout"
            label="Sign out idle sessions"
            description="End an administrator's session after a period of inactivity."
            defaultChecked
          />
        </div>
      </SettingsCard>
    </div>
  );
}

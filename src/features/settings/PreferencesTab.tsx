import { SettingsCard } from "./SettingsCard";
import { SettingsToggleRow } from "./SettingsToggleRow";
import { ComingSoonNote } from "./ComingSoonNote";

// The Preferences settings tab (TP1-11, P1-14). LAYOUT ONLY this phase: it shows the intended personal
// display preferences but persists nothing (a preference store is a later ticket), so every control is
// disabled and a banner says so. Presentation only — no data access, no state.

export function PreferencesTab() {
  return (
    <div className="flex flex-col gap-6">
      <ComingSoonNote>
        Preferences aren&apos;t active yet. This is a preview of what&apos;s coming — nothing here is saved.
      </ComingSoonNote>
      <SettingsCard
        title="Display"
        titleId="preferences-display-title"
        subtitle="How the console looks and behaves for you."
      >
        <div className="flex flex-col">
          <SettingsToggleRow
            id="pref-reduced-motion"
            label="Reduce motion"
            description="Minimise non-essential animations and transitions."
          />
          <SettingsToggleRow
            id="pref-compact-tables"
            label="Compact tables"
            description="Show more rows at once with tighter spacing."
          />
        </div>
      </SettingsCard>
    </div>
  );
}

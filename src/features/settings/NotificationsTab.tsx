import { SettingsCard } from "./SettingsCard";
import { SettingsToggleRow } from "./SettingsToggleRow";
import { ComingSoonNote } from "./ComingSoonNote";

// The Notifications settings tab (TP1-11, P1-14). LAYOUT ONLY this phase: it shows the intended notification
// preferences but persists nothing (the notification pipeline and the preference store are later tickets), so
// every control is disabled and a banner says so. Presentation only — no data access, no state.

export function NotificationsTab() {
  return (
    <div className="flex flex-col gap-6">
      <ComingSoonNote>
        Notification settings aren&apos;t active yet. This is a preview of what&apos;s coming — nothing here
        is saved.
      </ComingSoonNote>
      <SettingsCard
        title="Email notifications"
        titleId="notifications-email-title"
        subtitle="Choose which emails TrackPoli sends you."
      >
        <div className="flex flex-col">
          <SettingsToggleRow
            id="notif-admin-changes"
            label="Administrator changes"
            description="When an administrator is invited, changed, or removed."
            defaultChecked
          />
          <SettingsToggleRow
            id="notif-security-alerts"
            label="Security alerts"
            description="When your password or two-factor device is changed."
            defaultChecked
          />
          <SettingsToggleRow
            id="notif-product-updates"
            label="Product updates"
            description="Occasional news about new console features."
          />
        </div>
      </SettingsCard>
    </div>
  );
}

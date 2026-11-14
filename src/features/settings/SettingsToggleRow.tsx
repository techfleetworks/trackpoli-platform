import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// A single labelled toggle row for the Settings layout tabs (TP1-11, P1-14). In this phase the Notifications
// and Preferences tabs are LAYOUT ONLY: the controls are rendered to show the intended shape of the screen,
// but they are `disabled` and persist nothing (the preference store and the notification pipeline are later
// tickets). Rendering them disabled rather than wiring a no-op is deliberate — a control that looks live but
// silently discards the change is worse than one that is visibly not-yet-available (usability-ux-universal-
// design: a disabled control communicates "not available", a dead live control misleads). The Label is
// associated to the Switch (htmlFor/id) and the description is linked with aria-describedby so a screen
// reader announces it with the control (universal-accessibility-wcag: accessible-forms).

const bodyMedium =
  "text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)]";
const bodySmall =
  "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

export function SettingsToggleRow({
  id,
  label,
  description,
  defaultChecked = false,
}: {
  id: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  const descriptionId = description ? `${id}-desc` : undefined;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className={`${bodyMedium} text-foreground`}>
          {label}
        </Label>
        {description ? (
          <p id={descriptionId} className={`${bodySmall} text-muted-foreground`}>
            {description}
          </p>
        ) : null}
      </div>
      <Switch id={id} defaultChecked={defaultChecked} disabled aria-describedby={descriptionId} />
    </div>
  );
}

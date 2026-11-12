import * as React from "react";

import { cn } from "@/lib/utils";

// The grey "What happens next" explanatory note used by the Admin-management dialogs (TP1-10). Presentation
// only — copy is passed in. Rendered as an <aside> with a bold lead-in so the supplementary context is in the
// reading order for a screen reader (usability-ux-universal-design, universal-accessibility-wcag).

const bodySmall =
  "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

export function WhatNextNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <aside className={cn("rounded-[var(--md-shape-field)] bg-muted p-3 text-muted-foreground", bodySmall, className)}>
      <span className="font-medium text-foreground">What happens next</span>
      <p className="mt-1">{children}</p>
    </aside>
  );
}

// A dialog form-level error line (field errors use FormField's own error slot). role="alert" so a screen
// reader announces the failure once when it appears.
export function DialogError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className={cn(bodySmall, "text-destructive")}>
      {children}
    </p>
  );
}

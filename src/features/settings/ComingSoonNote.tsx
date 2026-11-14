import type { ReactNode } from "react";

// A small, honest "not available yet" banner for the layout-only Settings tabs (TP1-11, P1-14). The
// Notifications, Preferences and Workspace-rules tabs show their intended layout this phase but do not yet
// persist anything; this note states that plainly at the top of the tab so a user is never left wondering why
// a change did not stick (usability-ux-universal-design: set the right expectation, prevent the error rather
// than explain it after). Presentation only, token colours, no literal.

export function ComingSoonNote({ children }: { children: ReactNode }) {
  return (
    <aside
      className="rounded-[var(--md-shape-field)] bg-muted p-4 text-muted-foreground text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]"
    >
      {children}
    </aside>
  );
}

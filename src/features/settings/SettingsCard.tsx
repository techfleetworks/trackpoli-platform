import * as React from "react";

import { cn } from "@/lib/utils";

// The shared Settings card shell (TP1-11, P1-14). Presentation only — a titled surface the Settings tabs
// compose, so the card chrome (surface, border, radius, heading type) is defined once rather than copied into
// every card (DRY; judge-arch boundary placement). It is server-safe (no hooks, no "use client") so a server
// or client tab can both use it. Colour and shape come only from the semantic token utilities — no literal,
// no CSS module (ADR-0011). When `titleId` is given the <section> gets aria-labelledby, making it a named
// region a screen-reader user can jump to (universal-accessibility-wcag: name-role-value).

const titleMedium =
  "text-[length:var(--md-title-medium-size)] font-medium leading-[var(--md-title-medium-line)] tracking-[var(--md-title-medium-tracking)]";
const bodyMedium =
  "text-[length:var(--md-body-medium-size)] leading-[var(--md-body-medium-line)] tracking-[var(--md-body-medium-tracking)]";

export function SettingsCard({
  title,
  titleId,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  titleId?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-4 rounded-[var(--md-shape-card)] border border-border bg-card p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className={cn(titleMedium, "text-foreground")}>
            {title}
          </h2>
          {subtitle ? <p className={cn(bodyMedium, "text-muted-foreground")}>{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

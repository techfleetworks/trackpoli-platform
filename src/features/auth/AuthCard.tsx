"use client";

import * as React from "react";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import markIcon from "./assets/mark.svg";

// Shared shell for the auth screens (ADR-0028): the centred page, the card, and the brand lockup, built on
// the design-system Card primitive instead of the hand-built authCard.module.css (expand/contract migration,
// ADR-0011 D5). Colour comes from semantic tokens only (bg-muted page, bg-card surface, bg-primary mark,
// text-foreground name) — no CSS Module and no colour literal in feature code (decisions.md). The card keeps
// its MD3 shape/elevation via the retained --md-shape-card / --md-elevation-card tokens, so the visual shell
// is preserved; only the implementation moves onto the primitive.
function AuthCard({
  children,
  brandCentered = false,
  className,
  ...props
}: React.ComponentProps<typeof Card> & { brandCentered?: boolean }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-muted p-6">
      <Card
        className={cn(
          "w-[480px] max-w-full gap-[22px] rounded-[var(--md-shape-card)] border-0 p-10 shadow-[var(--md-elevation-card)]",
          className,
        )}
        {...props}
      >
        <div className={cn("flex items-center gap-3", brandCentered && "justify-center")}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-primary">
            <Icon src={markIcon} size={22} />
          </span>
          <span className="font-sans text-base font-medium text-foreground">TrackPoli Admin</span>
        </div>
        {children}
      </Card>
    </main>
  );
}

// The centred footer note under an auth card (e.g. the invitation-only line).
function AuthCardFooter({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("m-0 text-center text-sm text-muted-foreground", className)} {...props} />
  );
}

export { AuthCard, AuthCardFooter };

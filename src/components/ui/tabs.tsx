"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

// shadcn/ui Tabs (Radix), themed to the MD3 grayscale tokens (ADR-0011/ADR-0006). Radix gives the
// accessibility contract for free: role="tablist"/"tab"/"tabpanel", roving tabindex with arrow-key
// navigation, aria-selected on the active tab, and each panel labelled by its tab
// (universal-accessibility-wcag: keyboard-and-focus-management). The active tab is marked by an
// on-surface underline indicator and the on-surface text colour (grayscale, no brand hue - ADR-0006);
// inactive tabs use the muted foreground. Colour comes only from the semantic token utilities.

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex w-full items-stretch", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative flex flex-1 items-center justify-center whitespace-nowrap px-4 py-3 outline-none transition-colors",
        "text-[length:var(--md-label-large-size)] font-medium leading-[var(--md-label-large-line)] tracking-[var(--md-label-large-tracking)]",
        "text-muted-foreground hover:text-foreground",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
        "disabled:cursor-not-allowed disabled:opacity-60",
        // The active indicator: a 3px on-surface underline flush to the bottom of the trigger.
        "data-[state=active]:text-foreground data-[state=active]:font-semibold",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-transparent after:content-['']",
        "data-[state=active]:after:bg-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };

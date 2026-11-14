"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

// shadcn/ui Switch (Radix), themed to the MD3 grayscale tokens (ADR-0011/ADR-0006). Radix gives the
// accessibility contract for free: role="switch" with aria-checked, a focusable control toggled by Space,
// and association with a <Label htmlFor> (universal-accessibility-wcag: accessible-forms). Colour comes only
// from the semantic token utilities - no colour literal here. The on state is grayscale (the track fills with
// the on-surface foreground, the thumb in the surface colour), never a brand hue, so it matches the rest of
// the console while colour is deferred (ADR-0006). Phase 1 uses it only for the not-yet-wired Notifications
// and Preferences toggles, which are rendered disabled.
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-ring bg-background outline-none transition-colors",
        "focus-visible:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        "data-[state=checked]:border-foreground data-[state=checked]:bg-foreground",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-foreground shadow-sm transition-transform",
          "data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-background",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };

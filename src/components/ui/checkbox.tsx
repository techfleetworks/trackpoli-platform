"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

// shadcn/ui Checkbox (Radix), themed to the MD3 grayscale tokens (ADR-0011/ADR-0006). Radix gives the
// accessibility contract for free: role="checkbox" with aria-checked, it is a native-equivalent focusable
// control operated by Space, and it associates with a <Label htmlFor> (universal-accessibility-wcag:
// accessible-forms). Colour comes only from the semantic token utilities - no colour literal here. The
// checked state is grayscale (filled with the on-surface foreground, the tick in the surface colour),
// never a brand hue, so it matches the rest of the console while colour is deferred (ADR-0006).
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-5 shrink-0 rounded-[4px] border border-ring bg-background outline-none transition-colors",
        "focus-visible:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        "data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

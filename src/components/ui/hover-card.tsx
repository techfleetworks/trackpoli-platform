"use client";

import * as React from "react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Hover Card (ADR-0019) on Radix HoverCard (focus/hover intent, dismissal, and portal handled by Radix for
// accessibility). The `color` variant encodes the Figma hover-card colours; text colour follows the Color
// Usage set (Pine/Slate/Dark-Pine surfaces -> Mist text; Mist -> Dark Pine). Border is --input. No colour
// literal here (decisions.md).
const hoverCardContentVariants = cva(
  "z-50 w-64 rounded-xl border border-input p-4 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  {
    variants: {
      color: {
        default: "bg-popover text-popover-foreground",
        pine: "bg-pine text-mist",
        coral: "bg-coral text-dark-pine",
        slate: "bg-slate text-mist",
        mist: "bg-mist text-dark-pine",
      },
    },
    defaultVariants: { color: "default" },
  },
);

function HoverCard(props: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger(props: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />;
}

function HoverCardContent({
  className,
  color,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content> &
  VariantProps<typeof hoverCardContentVariants>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(hoverCardContentVariants({ color }), className)}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent, hoverCardContentVariants };

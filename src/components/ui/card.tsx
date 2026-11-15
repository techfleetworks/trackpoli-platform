import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Card primitive (ADR-0027), themed from the design-system tokens. The `color` variant encodes the Figma
// Card colour matrix; the Type dimension (Button / Photo / Avatar) is composition — compose CardImage for a
// photo card, an <img className="rounded-full"> in CardHeader for an avatar card, and CardFooter with
// <Button> for a button card. Border is the token --input (Dark Pine Translucent). Text colours follow the
// Color Usage decision set: Pine/Slate/Dark-Pine surfaces take Mist text; Mist takes Dark Pine; Coral is a
// decorative surface (Dark Pine text, below 7:1 — Coral carries no AAA text by design). No colour literal
// lives here (decisions.md) — colours come from the palette/semantic utilities.
const cardVariants = cva(
  "flex flex-col overflow-hidden rounded-xl border border-input",
  {
    variants: {
      color: {
        default: "bg-card text-card-foreground",
        pine: "bg-pine text-mist",
        coral: "bg-coral text-dark-pine",
        slate: "bg-slate text-mist",
        mist: "bg-mist text-dark-pine",
      },
    },
    defaultVariants: { color: "default" },
  },
);

function Card({
  className,
  color,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return <div data-slot="card" className={cn(cardVariants({ color }), className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-header" className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-lg font-semibold leading-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  // Inherits the card's text colour (so it adapts per colour variant); kept one step down in size.
  return <div data-slot="card-description" className={cn("text-sm", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-5 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3 p-5 pt-0", className)}
      {...props}
    />
  );
}

// Full-bleed media for the "Photo" card type. Decorative images pass alt=""; meaningful images pass real
// alt text (WCAG 1.1.1).
function CardImage({ className, alt = "", ...props }: React.ComponentProps<"img">) {
  // eslint-disable-next-line @next/next/no-img-element -- design-system primitive; consumers pass sized sources.
  return (
    <img
      data-slot="card-image"
      alt={alt}
      className={cn("h-40 w-full object-cover", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardImage,
  cardVariants,
};

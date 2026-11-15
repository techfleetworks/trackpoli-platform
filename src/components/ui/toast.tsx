import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Presentational Toast (ADR-0019): the design-system notification surface in its four brand colours, with a
// leading icon to the LEFT of the header (compose any lucide icon as the `icon`). This is the visual
// primitive, not a queue/provider — wire it into a notifier later. role="status" + aria-live so assistive
// tech announces it. Text colour per the Color Usage decision set (Dark Pine / Slate / Dark-Pine surfaces
// pair with Mist text where >=7:1; Coral is decorative). Border is --input (Dark Pine Translucent). The icon
// inherits the text colour via currentColor. No colour literal here (decisions.md).
const toastVariants = cva(
  "flex items-start gap-3 rounded-lg border border-input p-4 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        coral: "bg-coral text-dark-pine",
        "dark-pine": "bg-dark-pine text-mist",
        sage: "bg-sage text-dark-pine",
        mist: "bg-mist text-dark-pine",
      },
    },
    defaultVariants: { variant: "mist" },
  },
);

function Toast({
  className,
  variant,
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof toastVariants> & { icon?: React.ReactNode }) {
  return (
    <div
      data-slot="toast"
      role="status"
      aria-live="polite"
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {icon ? (
        <span data-slot="toast-icon" aria-hidden="true" className="mt-0.5">
          {icon}
        </span>
      ) : null}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function ToastTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="toast-title" className={cn("text-sm font-medium leading-tight", className)} {...props} />
  );
}

function ToastDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="toast-description" className={cn("text-sm", className)} {...props} />;
}

export { Toast, ToastTitle, ToastDescription, toastVariants };

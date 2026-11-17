import Link from "next/link";
import { Home, Landmark, Users, FileText, Menu, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Public app bottom navigation (Phase 3). The consumer surface's primary nav, fixed to the foot of the
// mobile frame. Only "Parties" resolves to a built screen in this slice; the other destinations (Home,
// Reps, Policies, More) arrive with their own screens, so they render for layout fidelity but are inert
// and announced as "coming soon" to assistive tech (never a dead link to a 404). Colour via semantic
// tokens only. The active item sets aria-current="page" (WCAG 4.1.2).

type NavKey = "home" | "parties" | "reps" | "policies" | "more";

interface NavItem {
  readonly key: NavKey;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Present once the destination screen exists; absent means "coming soon". */
  readonly href?: string;
}

const ITEMS: readonly NavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "parties", label: "Parties", icon: Landmark, href: "/app/parties" },
  { key: "reps", label: "Reps", icon: Users },
  { key: "policies", label: "Policies", icon: FileText },
  { key: "more", label: "More", icon: Menu },
];

const itemClass = "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1";
const labelClass =
  "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

export function BottomNav({ active }: { active: NavKey }) {
  return (
    <nav
      aria-label="Primary"
      className="flex items-stretch border-t border-input bg-background"
    >
      {ITEMS.map(({ key, label, icon: Icon, href }) => {
        const isActive = key === active;
        const content = (
          <>
            <Icon size={22} aria-hidden="true" className="shrink-0" />
            <span className={labelClass}>{label}</span>
          </>
        );

        if (href) {
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                itemClass,
                "transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                isActive ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              {content}
            </Link>
          );
        }

        return (
          <span
            key={key}
            aria-disabled="true"
            className={cn(itemClass, "text-muted-foreground opacity-60")}
          >
            {content}
            <span className="sr-only">(coming soon)</span>
          </span>
        );
      })}
    </nav>
  );
}

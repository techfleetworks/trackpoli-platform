import Link from "next/link";
import { ChevronRight, Check } from "lucide-react";

import type { Party } from "@/services/parties/partyTypes";

// A single row in the public Party Directory (Phase 3, Figma PartyCard 1580:2269). The whole row is one
// link to the party profile, so its accessible name is the party name plus its status text (never a
// chevron-only target). The avatar shows the abbreviation; the meta line joins the published facts; the
// status chips report registration and source state. Colour via semantic tokens only; the check icon is
// decorative because "INEC verified" is spelled out beside it (WCAG 1.1.1 / 1.4.1 — not colour-only).

function metaLine(party: Party): string {
  return [party.abbreviation, party.symbol, `Est. ${party.foundedYear}`]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

const chipClass =
  "inline-flex items-center gap-1 rounded-[8px] px-2 py-0.5 " +
  "text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)]";

export function PartyCard({ party }: { party: Party }) {
  const registrationLabel = party.registrationStatus === "registered" ? "Registered" : "Suspended";
  const verified = party.sourceStatus === "inec-verified";

  return (
    <Link
      href={`/app/parties/${party.slug}`}
      className={
        "flex items-center gap-3 border-b border-input bg-background px-4 py-3 " +
        "transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      }
    >
      <span
        aria-hidden="true"
        className={
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-secondary " +
          "font-heading text-[length:var(--md-label-large-size)] font-semibold text-secondary-foreground"
        }
      >
        {party.abbreviation.slice(0, 4)}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-heading font-semibold leading-tight text-foreground">
          {party.name}
        </span>
        <span className="truncate text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] tracking-[var(--md-body-small-tracking)] text-muted-foreground">
          {metaLine(party)}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2">
          <span className={chipClass + " bg-secondary text-secondary-foreground"}>
            {registrationLabel}
          </span>
          <span className={chipClass + " text-muted-foreground"}>
            {verified ? <Check size={13} aria-hidden="true" /> : null}
            {verified ? "INEC verified" : "Update pending"}
          </span>
        </span>
      </span>

      <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-muted-foreground" />
    </Link>
  );
}

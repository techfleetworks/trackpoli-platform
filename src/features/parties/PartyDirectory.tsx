"use client";

import { useMemo, useState, useId } from "react";
import { Search, Info, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listParties, type RegistrationFilter } from "@/services/parties/listParties";
import { PartyCard } from "./PartyCard";
import { BottomNav } from "@/features/public/BottomNav";

// The public Party Directory screen (Phase 3, Figma 1580:2235). Client component because search and the
// quick filter are live. All filtering/search logic lives in the listParties service (boundary rule); this
// screen is presentation + local UI state only. The full Filter & sort sheet (state, level, sort) is a
// later screen, so its entry points here (By state / By level / Filters) render for fidelity but are
// disabled and announced as "coming soon". Colour via semantic tokens only.

const chipClass = "h-9 rounded-full px-4 text-[length:var(--md-body-medium-size)]";

export function PartyDirectory() {
  const [search, setSearch] = useState("");
  const [registration, setRegistration] = useState<RegistrationFilter>("all");
  const searchId = useId();

  const parties = useMemo(
    () => listParties({ search, registration }),
    [search, registration],
  );
  const count = parties.length;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
        {/* The app-bar title is a compact title, not the page-hero h1; the unlayered base h1 rule
            (globals.css) is overridden with the important modifier to the design-system h4 size. */}
        <h1 className="font-heading text-[length:var(--text-h4)]! leading-[var(--leading-h4)]! font-bold">
          Parties
        </h1>
        <Button
          variant="ghost"
          size="icon"
          disabled
          aria-label="About this register (coming soon)"
          className="text-primary-foreground"
        >
          <Info size={22} aria-hidden="true" />
        </Button>
      </header>

      {/* Scrollable content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <label htmlFor={searchId} className="sr-only">
            Search parties by name, abbreviation or symbol
          </label>
          <div className="relative">
            <Search
              size={20}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, abbreviation or symbol"
              className="h-12 pl-11"
            />
          </div>
        </div>

        {/* Quick filters */}
        <div
          role="group"
          aria-label="Filter parties"
          className="flex gap-2 overflow-x-auto px-4 pb-3"
        >
          <Button
            size="sm"
            variant={registration === "all" ? "default" : "outline"}
            aria-pressed={registration === "all"}
            className={chipClass}
            onClick={() => setRegistration("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={registration === "registered" ? "default" : "outline"}
            aria-pressed={registration === "registered"}
            className={chipClass}
            onClick={() => setRegistration("registered")}
          >
            Registered
          </Button>
          <Button size="sm" variant="outline" disabled className={chipClass}>
            By state<span className="sr-only"> (coming soon)</span>
          </Button>
          <Button size="sm" variant="outline" disabled className={chipClass}>
            By level<span className="sr-only"> (coming soon)</span>
          </Button>
        </div>

        {/* Result count + filters entry */}
        <div className="flex items-center justify-between px-4 pb-2">
          <p
            aria-live="polite"
            className="text-[length:var(--md-body-small-size)] leading-[var(--md-body-small-line)] text-muted-foreground"
          >
            <span className="font-medium text-foreground">
              {count} {count === 1 ? "party" : "parties"}
            </span>{" "}
            · INEC national register
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled
            className="h-8 gap-1.5 rounded-full px-3 text-[length:var(--md-body-small-size)]"
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            Filters<span className="sr-only"> (coming soon)</span>
          </Button>
        </div>

        {/* List */}
        {count === 0 ? (
          <p className="px-4 py-10 text-center text-muted-foreground">
            No parties match “{search}”. Try a different name, abbreviation or symbol.
          </p>
        ) : (
          <ul className={cn("flex flex-col")}>
            {parties.map((party) => (
              <li key={party.slug}>
                <PartyCard party={party} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav active="parties" />
    </div>
  );
}

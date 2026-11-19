import type { Party } from "./partyTypes";
import { PARTY_FIXTURES } from "./parties.fixtures";

// The public directory reader. Pure (no React, no DOM — services AGENTS.md), so it runs in Node tests and
// on both the server page and the client view. It reads the published projection — the fixtures for now;
// the Supabase published view behind the same signature later. Only the facets the Directory screen
// actually drives live here (live text search + the All/Registered quick filter); the full Filter & sort
// sheet (state, level, sort) lands with its own screen, so this does not build facets nothing calls yet.

/** Registration quick-filter shown as the chip row on the directory. */
export type RegistrationFilter = "all" | "registered";

export interface PartyQuery {
  /** Free text matched against name, abbreviation and symbol (case/really-insensitive). */
  readonly search?: string;
  /** Quick registration filter; defaults to "all". */
  readonly registration?: RegistrationFilter;
}

function matchesSearch(party: Party, term: string): boolean {
  const haystack = [party.name, party.abbreviation, party.symbol ?? ""].join(" ").toLowerCase();
  return haystack.includes(term);
}

/**
 * Filter the published party projection for the directory. Returns a new array in the registry's default
 * order; callers read `.length` for the result count. An empty/whitespace search matches everything.
 */
export function listParties(query: PartyQuery = {}): Party[] {
  const term = (query.search ?? "").trim().toLowerCase();
  const registration = query.registration ?? "all";

  return PARTY_FIXTURES.filter((party) => {
    if (registration === "registered" && party.registrationStatus !== "registered") return false;
    if (term.length > 0 && !matchesSearch(party, term)) return false;
    return true;
  });
}

/** Read one party from the published projection by its slug, or `undefined` when none matches. */
export function getPartyBySlug(slug: string): Party | undefined {
  return PARTY_FIXTURES.find((party) => party.slug === slug);
}

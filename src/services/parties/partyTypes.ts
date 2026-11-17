// Public Party Directory domain types (Phase 3). These describe the *published projection* a public
// reader sees — verified, denormalized facts only — never the admin draft/workflow tables (decisions.md:
// "Public pages read only a published, denormalized projection"). The fixture reader in this folder
// stands in for that projection until the Supabase published view lands; the type is the seam, so the
// data source can change behind it with no UI change. Types live beside the service (services AGENTS.md),
// never imported from a component.

/** Where a party operates. Drives the "Level of operation" facet. */
export type PartyLevel = "national" | "regional";

/** INEC registration state. Drives the "Registration status" facet and the status chip. */
export type RegistrationStatus = "registered" | "suspended";

/**
 * Source/verification state for the party's facts. This is a statement about the *source*, not a
 * judgement that a claim is true (the design is explicit: "Labels reflect source status, not a
 * judgement that a claim is true").
 */
export type SourceStatus = "inec-verified" | "update-pending";

/**
 * One party as the public directory shows it. `statePresence: "all"` means a nationwide party present
 * in every state; otherwise it is the explicit list of states the party operates in.
 */
export interface Party {
  /** URL-safe stable id (also the profile route segment). */
  readonly slug: string;
  /** Short form shown as the avatar/initials and in the meta line, e.g. "APC". */
  readonly abbreviation: string;
  /** Full registered name, e.g. "All Progressives Congress". */
  readonly name: string;
  /** Party symbol as registered, e.g. "Broom". Optional — not every party publishes one. */
  readonly symbol?: string;
  /** Year founded/registered, e.g. 2013. */
  readonly foundedYear: number;
  readonly level: PartyLevel;
  readonly registrationStatus: RegistrationStatus;
  readonly sourceStatus: SourceStatus;
  /** `"all"` for a nationwide party, else the explicit states of operation. */
  readonly statePresence: "all" | readonly string[];
}

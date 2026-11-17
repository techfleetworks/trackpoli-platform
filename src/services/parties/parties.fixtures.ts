import type { Party } from "./partyTypes";

// Fixture stand-in for the published party projection (Phase 3). These are the sample parties shown in
// the Figma Party Directory (file IuroXSMAJAc3Eis66839gh, node 1580-2234). They are seed/display data,
// not personal data — party names and INEC registration facts are public record — so they carry no PII
// (data-map.json is unaffected). When the Supabase published view lands, listParties() reads it instead
// and this file is deleted; the Party type is the contract that keeps the UI unchanged.
//
// Registry order below is the directory's default ("Best match") order.
export const PARTY_FIXTURES: readonly Party[] = [
  {
    slug: "apc",
    abbreviation: "APC",
    name: "All Progressives Congress",
    symbol: "Broom",
    foundedYear: 2013,
    level: "national",
    registrationStatus: "registered",
    sourceStatus: "inec-verified",
    statePresence: "all",
  },
  {
    slug: "pdp",
    abbreviation: "PDP",
    name: "Peoples Democratic Party",
    symbol: "Umbrella",
    foundedYear: 1998,
    level: "national",
    registrationStatus: "registered",
    sourceStatus: "inec-verified",
    statePresence: "all",
  },
  {
    slug: "lp",
    abbreviation: "LP",
    name: "Labour Party",
    foundedYear: 2002,
    level: "national",
    registrationStatus: "registered",
    sourceStatus: "inec-verified",
    statePresence: "all",
  },
  {
    slug: "nnpp",
    abbreviation: "NNPP",
    name: "New Nigeria Peoples Party",
    foundedYear: 2002,
    level: "regional",
    registrationStatus: "registered",
    sourceStatus: "inec-verified",
    statePresence: ["Kano", "Lagos", "Kaduna"],
  },
  {
    slug: "apga",
    abbreviation: "APGA",
    name: "All Progressives Grand Alliance",
    symbol: "Cock",
    foundedYear: 2002,
    level: "national",
    registrationStatus: "registered",
    sourceStatus: "update-pending",
    statePresence: "all",
  },
  {
    slug: "sdp",
    abbreviation: "SDP",
    name: "Social Democratic Party",
    foundedYear: 2002,
    level: "regional",
    registrationStatus: "registered",
    sourceStatus: "inec-verified",
    statePresence: ["Osun", "Oyo"],
  },
];

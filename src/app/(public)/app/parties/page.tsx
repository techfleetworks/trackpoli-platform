import type { Metadata } from "next";
import { PartyDirectory } from "@/features/parties/PartyDirectory";

// Public Party Directory route — /app/parties within the /admin basePath (ADR-0036). Public and
// unauthenticated: the root layout resolves no session for an anonymous visitor and renders normally.
export const metadata: Metadata = {
  title: "Parties · TrackPoli",
  description: "Browse Nigeria's registered political parties, with sources for every fact.",
};

export default function PublicPartiesPage() {
  return <PartyDirectory />;
}

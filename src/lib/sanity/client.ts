import { createClient } from "next-sanity";

// The one Sanity client. Sanity owns editorial PROSE only; it references Supabase
// record ids and never stores a factual field (decisions.md). Read token (if the
// dataset is private) and the write token are server-only secrets, not set here.
export function getSanityClient() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  if (!projectId || !dataset) {
    throw new Error(
      "Sanity env is not set: NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET are required.",
    );
  }
  return createClient({
    projectId,
    dataset,
    apiVersion: "2024-10-01",
    useCdn: true,
  });
}

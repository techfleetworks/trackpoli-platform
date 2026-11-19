import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getPartyBySlug } from "@/services/parties/listParties";

// Party profile route (Phase 3). This slice ships the directory; the full Overview / Leadership / Record
// profile (Figma 1580:2306+) is a later screen. This is a real, reachable placeholder so a directory card
// is never a dead link — it resolves the party from the published projection or 404s on an unknown slug.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const party = getPartyBySlug(slug);
  return { title: party ? `${party.name} · TrackPoli` : "Party · TrackPoli" };
}

export default async function PartyProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const party = getPartyBySlug(slug);
  if (!party) notFound();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center gap-1 bg-primary px-2 py-3 text-primary-foreground">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="text-primary-foreground"
        >
          <Link href="/app/parties" aria-label="Back to parties">
            <ArrowLeft size={24} aria-hidden="true" />
          </Link>
        </Button>
        <span className="font-heading font-semibold">Party profile</span>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-6">
        <h1 className="font-heading text-[length:var(--text-h3)]! leading-[var(--leading-h3)]! font-bold text-foreground">
          {party.name}
        </h1>
        <p className="text-muted-foreground">
          {party.abbreviation}
          {party.symbol ? ` · ${party.symbol}` : ""} · Est. {party.foundedYear}
        </p>
        <p className="mt-4 text-muted-foreground">
          The full party profile — overview, leadership and electoral record, each with its sources —
          arrives in the next part of this feature.
        </p>
        <Button asChild variant="outline" className="mt-4 w-fit">
          <Link href="/app/parties">Back to the directory</Link>
        </Button>
      </div>
    </div>
  );
}

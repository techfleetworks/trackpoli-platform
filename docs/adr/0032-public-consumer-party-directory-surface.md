# 0032. Public consumer Party Directory surface under an /app segment

Date: 2026-11-17

## Status

Accepted

Deciders: TrackPoli engineering. Related: ADR-0011 (shadcn/ui component system), ADR-0014
(basePath-relative navigation), ADR-0016 (redirect bare root to the basePath), ADR-0018 (Bold Pines
brand tokens).

## Context and Problem Statement

Phase 3 introduces the first **public, unauthenticated** TrackPoli surface: a mobile Party Directory
(Figma file IuroXSMAJAc3Eis66839gh, node 1580-2234) where any visitor browses Nigeria's registered
political parties. Everything shipped so far in this repository is the invitation-only **admin** app:
`next.config.ts` sets `basePath: "/admin"`, so every page, asset and API route is served under `/admin`,
and the authenticated `src/app/(app)` group already owns `/parties`, `/policies`, `/politicians` and the
rest. We need a home for the public screens that (a) does not sit behind the admin session guard, (b) does
not collide with the admin's own route names, and (c) keeps the public data rule from `decisions.md`:
"Public pages read only a published, denormalized projection; the admin app works on the live draft
tables." The question this ADR settles is **where the public surface lives in the route tree, and how its
data is sourced for the first slice.**

## Decision Drivers

- No route collision with the existing admin segments served under the same `/admin` basePath.
- The public surface must be reachable without a session; the admin guard lives on `(app)`, not globally.
- The one-owner-per-fact and published-projection rules must hold from the start, even before the
  Supabase published view exists.
- Keep the first slice small and reviewable; do not stand up a second Next app or a new deployment to
  land one screen.

## Considered Options

- **New `(public)` route group under an `/app` segment in this app** — `src/app/(public)/app/parties`,
  served at `/admin/app/parties`. A sibling to `(app)` with its own layout and no session guard.
- **Reuse the admin `(app)/parties` placeholder** — build the public directory at the existing admin
  route inside the authenticated shell.
- **Separate Next app / deployment (or subdomain) now** — give the public app its own basePath or host.

## Decision

Chosen: **Option 1.** The public consumer surface is a new `(public)` route group with its own layout and
no session guard, rooted at an `/app` path segment so its routes read `/admin/app/parties` and never
collide with the admin's `/admin/parties`. The directory reads parties through a service seam
(`src/services/parties/listParties.ts`) whose current source is a typed fixture standing in for the
published projection; the Supabase published view replaces the fixture behind the same `Party` type with
no UI change.

Option 2 is rejected: the public app must not inherit the admin's auth, shell, or draft-table data access,
and mixing the two surfaces in one route group blurs that boundary. Option 3 is rejected **for now** as
premature — it is the right long-term shape but needs its own hosting/basePath decision and buys nothing
for a single screen; it is recorded below as the follow-up.

## Consequences

- **Positive:** The public surface is isolated from the admin session and shell; routes cannot collide;
  the published-projection boundary is honoured through one reader; the slice is a handful of files behind
  the enterprise gates (tests, BDD, a11y verdict, arch review).
- **Negative / known limitation:** The interim URL is `/admin/app/...`, which is semantically odd for a
  public page (the `/admin` basePath is the whole app's, per ADR-0014/0016). This is deliberate and
  temporary.
- **Follow-up (tracked):** Give the public app its own hosting — a distinct basePath or a public subdomain
  via Cloudflare — so public URLs drop the `/admin` prefix. That is a separate deployment decision and its
  own ADR.
- **Follow-up (tracked):** Replace the fixture reader with the Supabase published party projection behind
  the same `Party` type and `listParties` signature; that change is a schema/data decision with its own
  ADR and migration-safety record.
- The remaining Phase 3 screens (Filter & sort sheet, the Overview / Leadership / Record profile) build on
  this group in their own PRs; the directory's disabled facet entry points become live when the sheet
  lands.

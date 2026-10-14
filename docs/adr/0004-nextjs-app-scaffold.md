# 0004. Next.js (App Router) for the TrackPoli web app

Date: 2026-10-14

## Status

Accepted

## Context

TrackPoli needs a web app on Vercel with a public, source-backed read layer and a server-side admin
data pipeline (Supabase service-role, Sanity write token). Vercel's import defaulted to Create React
App, but the committed architecture (`decisions.md`, `AGENTS.md`, `arch-gate.config.json`) assumes
Next.js App Router, and the product requirements point the same way.

## Decision

We build the app with **Next.js 14 (App Router)**, not Create React App. The initial scaffold adds a
static public home page, the canonical single clients the arch-gate expects
(`src/lib/supabase/{client,server,admin}.ts`, `src/lib/sanity/client.ts`), a pure domain service with
a test, and a BDD feature for the home page. All backend clients read their env lazily, so the build
is green with no environment configured; a real call fails loudly.

## Consequences

Three forces decide it:

1. **Security.** The admin pipeline needs the Supabase service-role key and a Sanity write token, which
   bypass access control and must stay server-only. CRA is a pure client SPA with no server, so those
   secrets would leak into the browser bundle. Next.js provides server routes/components to hold them.
2. **The product requirements.** SEO for public politician/policy pages and low-bandwidth performance
   (a stated Veteran/citizen need) both want server rendering (SSR/SSG), which CRA cannot do.
3. **Maintenance.** CRA is no longer recommended by the React team; Next.js is Vercel's first-class
   framework and matches the existing architecture, so no rewrite of the gate or decisions is needed.

The cost is Next.js's larger surface (server/client boundary, its own caching model) over a plain SPA.
Honest limit: the accessibility conformance record shipped with this scaffold is an author code-review
verdict for a trivial static page; an independent human accessibility review with assistive technology
is still required before launch, and the env-dependent backend paths are unexercised until the Supabase
and Sanity projects exist.

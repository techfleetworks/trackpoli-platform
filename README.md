# trackpoli-platform

TrackPoli: a trusted, source-backed, plain-language platform to track political
accountability in Nigeria. Next.js (App Router) on Vercel, Supabase (facts, workflow,
auth), Sanity (editorial prose), Cloudflare (security/CDN).

## Local development

```bash
npm install
npm run dev            # Next.js on http://localhost:3000 (static pages build with no env set)
```

To run the database locally (requires the Supabase CLI and Docker):

```bash
supabase start        # local Postgres + Auth + Studio
supabase db reset     # applies supabase/migrations/ then supabase/seed.sql (example data)
```

Copy `.env.example` to `.env.local` and fill in the Supabase/Sanity values (the CLI
prints local keys on `supabase start`). The seed data is clearly-labelled SAMPLE data,
not real records.

## Engineering gates

Every change passes the enforced CI gates. Run them locally before pushing:

```bash
npm run check:blocking   # the always-on core gates
```

See `CONTRIBUTING.md` for the full PR workflow (judge-arch review, skill receipt,
routing), `AGENTS.md` for the standing rules, and `docs/adr/` for the decisions.

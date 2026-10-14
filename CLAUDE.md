# TrackPoli project instructions

TrackPoli is a trusted, source-backed, plain-language political accountability platform for Nigeria.
Stack: Next.js (App Router) on Vercel, Supabase (relational facts, workflow state, auth), Sanity
(editorial prose), Cloudflare (security/CDN).

## Enterprise engineering standards are always on here

The directive below is imported, so a session rooted in this repo or a subdirectory loads it
automatically as context, with no setup and no approval, and a `git pull` keeps it current. The
committed hook in `.claude/settings.json` injects the same directive into subagents as well,
including the built-in Explore and Plan agents, after a one-time workspace-trust step.

These layers deliver the **directive text** on pull; they do not install the skills themselves into
`~/.claude`, and they do not reach a session rooted above or outside this repo. For that broader
coverage, run the one-time installer in `.claude/skills/bootstrap/`. See `always-on/README.md` for
the coverage map and its limits.

## The gate, in one line

Every change passes the architecture gate before it is "done": `npm run check:architecture` exits 0
locally and in CI, and the `judge-arch` review is PASS-or-all-waived. See `decisions.md` for the
standing rules with examples from this codebase, `AGENTS.md` for the always-on rules, and
`CONTRIBUTING.md` for the full PR checklist (receipts, routing, review log).

@always-on/enterprise-skills-always-on.md

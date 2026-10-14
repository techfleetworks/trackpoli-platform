# 0005. Supabase owns facts, Sanity owns prose

Date: 2026-10-14

## Status

Accepted

## Context

TrackPoli stores two very different kinds of content: structured, relational, frequently-updated facts
(politicians, parties, bills, votes, policies, sources, and their verification state) and human-authored
editorial prose (plain-language explanations, "why this matters", glossary, manifesto narrative). It has
two datastores available: Supabase (Postgres, relational, with Row Level Security and auth) and Sanity (a
content CMS with a good editing UI). The risk to avoid is the same fact living in both and being "kept in
sync", which the architecture gate's data-ownership rule exists to prevent.

## Decision

Every fact has exactly one owner. **Supabase is the system of record for all factual, relational, and
workflow data**: the politician / party / bill / policy / vote entities, the Source entity, the
verification and publication state, the audit log, and access control. **Sanity owns editorial prose
only**, and a Sanity document references a Supabase record id; it never duplicates a factual field, and
Supabase never stores prose. The architecture gate enforces the checkable half: a rule forbids defining a
factual field (party id, office, vote count, registration number, date of birth, ...) in a Sanity schema
(`arch-gate.config.json`), and the mirror smell ("kept in sync") is a built-in violation. The initial
Supabase schema lands in this change (`supabase/migrations/20261014120000_core_schema.sql`); Sanity is
introduced only when the editorial workload justifies it, and may be deferred past MVP 1.

## Consequences

One owner per fact means search, filtering, RLS, and the review pipeline all run against Supabase, and
the prose layer composites onto it at read time by id. There is no bidirectional sync to build or to drift.
The cost is that editorial authors eventually use a second tool (Sanity Studio) for prose while facts are
managed in the admin app, and a public page must join two sources at render time.

Honest limit: the gate can forbid a factual field name in a Sanity schema, but it cannot prove the human
drew the fact/prose line correctly in every case; that judgment stays with the judge-arch review. Until
Sanity is actually adopted, this ADR governs intent, not a running integration.

# 0037. TrackPoli database ERD (foundation as-built + accountability domain proposed)

## Status

Proposed — 2026-11-19. The accountability-domain half is to be confirmed against the Vision/Scope + EFT board and promoted to Accepted once backed by SQL migrations.

## Context and Problem Statement

TrackPoli is a source-backed, plain-language political-accountability platform for Nigeria. The team needs one shared entity-relationship diagram of the whole database — to align on before more of it is written, and to share in Discord. The database has two layers, and this ADR records the decision to diagram both in `../database-diagram.md`:

- The **foundation / auth layer is already built** — migrations `001`–`011` provide admin identity (`public.profiles`), the action audit trail (`public.activity_events`) and ops log (`public.operational_events`), sign-in lockouts, rate limits, notification preferences, and terms/privacy version acceptance. That half of the diagram is rendered as-built from the real DDL.
- The **accountability domain is not built** — there are no `politicians`, `parties`, `bills`, `votes`, or `sources` tables in `supabase/migrations/`. The standing rules in `decisions.md` fix the boundaries (Supabase owns facts, Sanity owns prose; a published projection serves the public; one writer per fact; a party-membership table over time), and the requirements document "TrackPoli Database Schema — Functional & Non-Functional Requirements" fixes the capabilities (SFR-1 through SFR-16) and qualities (SNFR-1 through SNFR-16). This ADR records the proposed model turning those into named entities, keys and relationships.

## Decision Drivers

- SFR-12 and SNFR-2: provenance is structural — every claim must have a place for one or more sources, never a free-text field.
- SNFR-4: what a politician "said" (a stance) and "did" (a vote) are separate, comparable, never conflated.
- SNFR-3: office terms, party memberships and stances are time-bounded; history is appended, never overwritten.
- `decisions.md`: the public reads only a published projection; admin edits live rows; one owner per fact; Sanity holds prose referenced by a Supabase id.
- Reuse, not duplication: admin identity and the audit trail already exist in the foundation layer and must be referenced, not re-created.

## Considered Options

- **Option A — one shared polymorphic provenance table, draft/published as record state, valid-time history, reusing the foundation's admin and audit tables.** A single `source_links` table carries `source_id` plus a `subject_type` and `subject_id` pointing at any claim-bearing row. Publication is a status on each record rather than a duplicate set of tables. Domain records reference the existing `profiles` for `verified_by` and are audited through the existing `activity_events`.
- **Option B — per-fact-type source join tables, a duplicated projection table for every entity, and a new domain-specific admin/audit pair.** A separate link table per fact type, a physically separate published table mirroring each draft table, and fresh `admin_users` / `audit_log` tables alongside the foundation ones.
- **Option C — defer relational modeling and ingest prose-first into Sanity.** Model the domain as editorial documents now and extract facts later.

## Decision Outcome

Chosen: **Option A**.

- Option A realizes SFR-12's "one shared link" directly: one enforceable path makes the publish rule (SNFR-12, no claim published without a source) checkable in one place, and lets a retracted source find every dependent claim (SNFR-15). Option B satisfies the same rules but multiplies tables and scatters the publish and retraction logic, which drifts.
- Representing publication as record state, not duplicated tables, keeps the diagram legible and avoids a second mirror of every entity (a `decisions.md` anti-pattern); the published projection is a derived read model, not hand-kept copies.
- Reusing `profiles` and `activity_events` avoids a second admin identity and a second audit trail, which would split who-did-what across two systems. Option C was rejected: it inverts the ownership rule (Sanity references facts, it does not hold them) and makes provenance and the said/did split impossible to enforce.

## Consequences

- **Good.** One provenance path for every fact; the publish-needs-a-source rule is enforceable at one boundary; said and did stay comparable through a shared issue; history is append-only; each fact has one write path; admin identity and audit are not forked.
- **Bad / risks.** A polymorphic `source_links` subject cannot carry a database-level foreign key to its target, so referential integrity for those links must be enforced at the service layer plus a `subject_type` check constraint — the cost of the shared link, called out for review. Publication-as-state demands discipline so no public query ever reads a draft or unverified row; the published projection must enforce it.
- **The accountability half is proposed, not as-built.** Evidence state: `inferred` / `documented`. Every column, type, key and cardinality for the accountability tables is a proposal to validate, because no such migration exists yet (`observed`: `supabase/migrations/` holds `001`–`011`, all foundation/auth, and no politicians/parties/bills/votes/sources tables). That half reaches as-built quality only once real SQL migrations back it and it is re-checked against Supabase's Schema Visualizer. The foundation half of the diagram is already as-built, rendered from the committed DDL.
- **PII classes for the proposed tables are not yet tagged.** `observed`: `data-map.json` currently tags only foundation fields. The classes shown for `POLITICIANS` must be added to `data-map.json` when those tables land, or the untagged-PII gate will (correctly) block them.
- **MVP scope is inferred.** The Vision/Scope + EFT board (full user-story wording and the MVP-versus-MMP split) could not be read this session, so scope follows the `Must` MoSCoW tags in the requirements document and is marked to confirm against the board. `Should` entities (name aliases, job state) are named but deferred.

## Evidence & skeptical assessment

- Claim — the foundation half of the diagram is as-built. State: `observed`. Source (re-runnable): `supabase/migrations/001`–`011` create `profiles`, `notification_preferences`, `activity_events`, `operational_events`, `rate_limits`, `policy_versions`, `policy_acceptances`, `sign_in_lockouts`; the diagram's columns and keys match that DDL. Limitation: reflects the working tree at this commit.
- Claim — the accountability domain is unbuilt. State: `observed`. Source: none of those migrations create a politician, party, bill, vote, or source table. Limitation: reflects the working tree at this commit.
- Claim — the proposed model satisfies the Must capabilities. State: `documented`. Source: the requirements document's SFR-1…16 and SNFR-1…16, mapped entity-by-entity in `../database-diagram.md`. Limitation: a requirement-to-entity mapping is not proof the fields are sufficient; it is validated only when migrations and queries exist.

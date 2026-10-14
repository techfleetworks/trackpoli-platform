# 0006. Verification and publication state model

Date: 2026-10-14

## Status

Accepted

## Context

TrackPoli's trust proposition is that public data is verified against sources before anyone sees it. Data
arrives from several paths (manual entry, CSV import, AI-assisted population) and must not reach the
public until a human has reviewed it. So the schema needs a single, first-class state model that every
ingestion path shares, and the public read path must be unable to see anything unreviewed. This is one of
the two expensive-to-retrofit decisions (the other is data ownership, ADR-0005), so it is built into the
initial schema, not added later.

## Decision

Every content record carries a `record_status` enum:
`draft → awaiting_review → approved → published`, with `rejected` and `needs_correction` as loop-back
states. `published` is the only publicly visible state. The lifecycle is enforced in three places:

1. **The column.** `status record_status not null default 'draft'` on every content table, so a new
   record is never public by default.
2. **Row Level Security (the public read model).** Anonymous and authenticated roles may `select` only
   rows where `status = 'published'`; all writes and all access to draft rows require an admin
   (`public.is_admin()` against `user_roles`). Public pages therefore read a *published projection* and
   can never query draft or unverified rows.
3. **Auditability.** A `review_events` table records every status transition (who, when, from, to, why),
   and an append-only `audit_log` (admin-readable, written by a `SECURITY DEFINER` trigger, with no
   update/delete policy) records every change. The Source entity and `source_links` let any claim carry
   its provenance, so "approved" can mean "checked against a source", not merely "an admin clicked yes".

## Consequences

Unverified data cannot leak to the public even if application code is wrong, because RLS enforces it at
the database. Every ingestion path (manual, CSV, AI) funnels through the same states, so the review
workflow is built once. The audit trail supports accountability and future compliance (retention is in
the data map). The cost is that every read path must respect the status filter (public reads published;
the admin app reads drafts via the service role), and the admin UI must drive the transitions, which is
Phase 1 work.

Honest limit: RLS guarantees the public cannot read non-published rows, but the *correctness* of a
verification (did the reviewer actually check the source?) is a human judgment the schema records but
cannot prove. The service-role key bypasses RLS by design and must stay server-only (ADR-0004, OWASP).

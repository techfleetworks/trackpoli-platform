<!-- The review workflow TrackPoli requires of every change. See CONTRIBUTING.md. -->

## What and why

<!-- What this change does, and the reason for it. Link the ADR if it is an architectural or schema decision. -->

## Review checklist (required before merge)

- [ ] **Core gates green.** `npm run check:blocking` exits 0 locally, and the surface gate for any surface you touched (`npm run check:migrations`, `check:owasp:lints`, `check:gherkin`, ...) passes. The required CI checks (`gates`, `routing`, `receipt`, `arch-review`) are green.
- [ ] **Fresh-context judge-arch run.** The change was reviewed by `judge-arch` in fresh context (it dispatches the review to a subagent), every finding is resolved or explicitly waived, and the review is recorded in `docs/arch-reviews/log.jsonl`.
- [ ] **Discriminating tests.** Every new or changed gate has a test that fails if the gate stops detecting (verifiable-quality-gates); new behavior has a test (or a BDD scenario) that would fail without the change.
- [ ] **Evidence ledger.** Factual claims in this PR and in any ADR carry an evidence state, a re-runnable source, and a named limitation (skeptical-audit); nothing is called done, secure, or passing without it.
- [ ] **ADR for decisions.** Any architectural or schema decision has an ADR under `docs/adr/` in this same change (architectural-decision-records).
- [ ] **Routed artifacts present.** The kind of change carries its discipline's artifact: a schema change needs an ADR and a safe migration, an auth change needs a `@security` scenario, a UI change needs an accessibility verdict, source needs a test. The `routing` check confirms it.
- [ ] **Skill-application receipt.** `docs/skill-receipts/log.jsonl` has an entry for this change covering every skill (applied or not-applicable); each `applied` entry cites a real skill heading, quotes at least eight exact words from under that heading, and names files in this change. `npm run check:receipt` passes. This proves grounding, not that the work is good, so review it against the diff.

## Honest limit

<!-- What this change does NOT do, plus any known risk or follow-up. Candor over false completeness. -->

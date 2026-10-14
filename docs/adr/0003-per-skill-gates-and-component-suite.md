# 0003. One CI gate per skill, plus the component discrimination suite

Date: 2026-10-14

## Status

Accepted (extends 0002)

## Context

ADR-0002 wired the skills as a small number of bundled CI checks (a `gates` job plus governance
jobs). That enforced the standards but did not make each skill individually visible or independently
required: a reader of the checks list could not see, per skill, that its gate ran. The team asked for
100% coverage - every skill its own named gate check, and every gate SCRIPT (component) self-verified -
to dogfood the skills library fully. This reverses the narrower decision in the earlier discussion to
rely on `check:discriminate` alone rather than mirror the library's test suite; the trade-off
(maintaining a vendored copy of the suite, re-mirrored on each skills upgrade) is accepted in exchange
for complete, per-component proof that every gate detects.

## Decision

The CI workflow runs one named check per skill via a matrix (`skill (<name>)`), each a required status
check in `.github/rulesets/main-protection.json`:

- 14 skills run their own mechanical gate (surface-dependent ones are guarded: green until their
  surface lands, then enforcing).
- `verifiable-quality-gates` runs the component discrimination suite: 29 of the library's 31 test
  files (`npm test`), proving every vendored gate script fails if it stops detecting. The two excluded
  tests (`arch-gate-wired`, `required-checks`) assert the skills LIBRARY's own CI wiring - its context
  names - which TrackPoli intentionally differs from, so they are not TrackPoli components.
- `enterprise-architecture-standards` and `judge-arch` are both enforced by the architecture gate
  (`check:architecture`); `judge-arch` additionally owns the review-coverage gate (`arch-review` job)
  and the reference-link gate.
- `usability-ux-universal-design` ships no standalone lint in the library; its required check asserts
  that the skill is coupled to every UI change in the receipt gate, and its real enforcement is the
  receipt plus the judge-arch review.

The skill-application receipt marks all 16 skills `applied`, each grounded with a verbatim quote and
the files in this change that wire its gate.

## Consequences

Every skill is now an independently visible, independently required CI check: a reader sees a green
tick per skill, and a regression in any one skill's gate blocks merge on its own without masking the
others (`fail-fast: false`). Every gate script is proven to detect by its committed test. The cost is
the vendored `test/` suite, which must be re-mirrored together with the skills on each upgrade (the
bootstrap reconcile flow), and a larger required-check set (20 checks) to maintain in the ruleset.

Honest limits: the component suite proves the gate scripts detect, not that TrackPoli's own future
gates will; `enterprise-architecture-standards` and `usability-ux-universal-design` have no unique
mechanical lint, so their named checks share the architecture gate and the receipt-coupling assertion
respectively rather than a dedicated detector - stated here rather than papered over. The parallel
`npm test` run can exhaust process forks on some Windows shells (not on the Linux CI runner); a local
Windows developer who hits it runs `npm test -- --test-concurrency=1`.

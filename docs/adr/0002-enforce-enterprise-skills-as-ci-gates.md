# 0002. Enforce the enterprise skills as CI/CD gates

Date: 2026-10-14

## Status

Accepted

## Context

TrackPoli is a greenfield application built by multiple contributors. The organisation maintains a
library of enterprise engineering skills (`enterprise-software-AI-skills`) whose standards are only
real if they are enforced: a skill that is documented but not gated is advisory, and a contributor
who does not use the skills would bypass every standard silently. We need the standards enforced in
CI so that bypassing them blocks merge, not just discouraged by convention. The repo is empty, so we
can enforce from the first commit with no legacy debt to grandfather.

## Decision

We vendor the skills under `.claude/skills/` (pinned by commit) and wire their mechanical checks as
required CI status checks on `main`, applied as code via `.github/rulesets/main-protection.json` and
`scripts/apply-ruleset.sh`. Enforcement is tiered:

- **Core gates** (`check:architecture`, `check:discriminate`, `check:links`, `check:retention`) run
  unconditionally; they are meaningfully green on an empty repo and enforce as code lands.
- **Surface gates** (`owasp:lints`, `no-ua`, `migrations`, `pii`, `alerts`, `gherkin`, `bdd-tags`)
  fail closed on zero files by design, so the `gates` job runs each one only once its surface has
  files - they auto-activate with no manual promotion.
- **Governance checks** (`routing`, `receipt`, `arch-review`) are the anti-bypass mechanism: a PR
  that does not engage the skills produces no routed artifact, no skill-application receipt, and no
  judge-arch review entry, and therefore cannot merge.

The always-on directive reaches contributors' agents through the committed `.claude/settings.json`
hook and the `CLAUDE.md` import; a dependency-free CI canary proves the hook still emits.

We adopt the React/Supabase architecture preset, adapted to Next.js + Supabase + Sanity, including a
data-ownership rule encoding "Supabase owns facts, Sanity owns prose" (`decisions.md`).

## Consequences

Every change is held to the architecture, security, testing, compliance, accessibility, and
evidence standards mechanically, and a contributor cannot skip them and still merge. Enforcement
strengthens automatically as the app grows (surface gates activate per surface). The cost is the
per-PR discipline (a receipt, a review log entry, routed artifacts) and the maintenance of keeping
the vendored skills current via the bootstrap reconcile flow.

Honest limits: the governance checks prove the artifacts exist and are grounded (verbatim quotes,
diff binding, coupling); they do not prove the judgment behind them was sound, so human review
remains required. The CI canary proves the hook emits, not that a given contributor's local session
fired it - but the governance checks catch the consequence (missing artifacts) regardless of local
setup. `esk-init --check` is deliberately not used as a drift gate here because it resolves "current
version" from the repo's own `package.json`, which is TrackPoli's app version, not the skills
version; tamper and staleness of the vendored engine are instead caught by the committed diff plus
review.

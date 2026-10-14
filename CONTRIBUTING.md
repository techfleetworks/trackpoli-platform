# Contributing to TrackPoli

Every change passes the enterprise engineering gates before it is "done." The gates are enforced
in CI and required to merge into `main`; this document is the human half of that contract.

## The gate, in one line

`npm run check:blocking` exits 0 locally, the CI checks are green, and the `judge-arch` review is
PASS (or every finding is explicitly waived). See `AGENTS.md` for the always-on rules, `decisions.md`
for the standing rules with examples from this codebase, and `always-on/README.md` for how the
always-on skills directive reaches your session.

## How enforcement is tiered

- **Core gates (always on).** `check:architecture`, `check:discriminate`, `check:links`,
  `check:retention`. Meaningfully green on an empty repo; they enforce the moment code or docs land.
  Run them with `npm run check:core`.
- **Surface gates (auto-activating).** `check:owasp:lints`, `check:no-ua`, `check:migrations`,
  `check:pii`, `check:alerts`, `check:gherkin`, `check:bdd-tags`. Each fails *closed* when it has
  nothing to scan, so the CI `gates` job runs each one only once its surface has files. They stay
  green until the surface lands, then enforce automatically. Run the relevant one locally once you
  add that surface (for example `npm run check:migrations` after writing your first migration).
- **Report gates (receipt-declared until wired).** `check:test-shape`, `check:a11y:axe`,
  `check:a11y:checklist`, `check:bdd-executed`, `check:security-coverage` need a produced report
  (a JUnit/cucumber run, an axe run, declared controls). Until the surface and its CI report exist,
  the PR receipt must declare them applied-or-not-applicable. Promote one into the `gates` job when
  its report pipeline is in place.

## Required CI checks (branch protection)

Defined as code in `.github/rulesets/main-protection.json` and applied with
`scripts/apply-ruleset.sh`:

- `gates` — the core gates plus any surface gate whose files exist.
- `routing` — a change that touches a routed surface must ship its required artifact
  (`routing-rules.config.json`). A schema change needs an ADR and a safe migration; an auth change
  needs a `@security` scenario; a UI change needs an accessibility verdict; source needs a test.
- `receipt` — every PR carries a complete skill-application receipt in
  `docs/skill-receipts/log.jsonl` covering every skill (applied with a verbatim quote, or
  not-applicable with a reason). Coupled surfaces (`skill-receipt.config.json`) must be `applied`.
- `arch-review` — the `judge-arch` review for the change is recorded in
  `docs/arch-reviews/log.jsonl` and covers the changed code files.

## Before you open a pull request

1. Run `npm run check:blocking` and the surface gate for any surface you touched; fix what fails.
2. Run the `judge-arch` skill in fresh context on your diff. Resolve or explicitly waive every
   finding, and append the review to `docs/arch-reviews/log.jsonl`.
3. Append your skill-application receipt to `docs/skill-receipts/log.jsonl`. Run
   `npm run check:receipt` to confirm it is complete and every quote is verbatim.
4. If your change adds, moves, deletes, or restructures code or schema, record the why in an ADR
   under `docs/adr/`.
5. Fill in the pull request template (`.github/pull_request_template.md`).

Loaded is not the same as reviewed, and a green check is not proof the work is good: a human still
reviews every change.

## Keeping the skills current

The enterprise skills are vendored under `.claude/skills/` and pinned by commit. To move to a newer
version, follow `.claude/skills/bootstrap/SKILL.md` (the reconcile flow), which re-points the hook
and updates the vendored skills together, then open a PR so the change is reviewed like any other.

## Evidence discipline

Every factual claim in a review, a receipt, or a PR description carries an evidence state, a
re-runnable source, and a named limitation. The canonical contract is
`.claude/skills/skeptical-audit/references/evidence-discipline.md`.

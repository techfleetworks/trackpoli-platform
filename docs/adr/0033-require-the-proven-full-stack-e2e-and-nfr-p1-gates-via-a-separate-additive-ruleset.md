# 0033. Require the proven full-stack E2E and NFR-P1 gates via a separate additive ruleset

Date: 2026-11-18

## Status

Accepted

Builds on the full-stack E2E harness (PR #67) and the NFR-P1 lighthouse stabilisation (ADR-0032, PR #68).
Touches `.github/workflows/e2e.yml` (job names), adds `.github/rulesets/e2e-acceptance.json`, and generalises
`scripts/apply-ruleset.sh`.

## Context

After PR #67 and #68, the full-stack E2E jobs (`e2e-full-stack`, `e2e-full-stack-sessions`) and the
`lighthouse` NFR-P1 job run on every PR and are green, but they are **advisory** — not in any required-status-
checks ruleset, so a PR can merge with them red. `verifiable-quality-gates` is explicit that this is the weak
state to fix: "A quality gate is only worth the failures it catches," and "A check that runs in no pipeline is
not a safety net, it is a comment that lies." These gates are also *proven to detect*: the full-stack suite
surfaced four real production bugs (#61/#63/#64/#66), and the lighthouse gate ships a mutation-proven
discrimination test (ADR-0032). So they are legitimate to require.

The obvious move — add them to the committed `main-protection.json` and run `scripts/apply-ruleset.sh` — is a
trap, because that file has drifted ahead of what is live and was never applied (the open "apply the ruleset"
TODO):

| | Live now | Committed `main-protection.json` |
|---|---|---|
| required PR approvals | 0 | **1** |
| `check (dependencies)` required | no | **yes** |
| `check (lint/typecheck/unit/bundle-size/secrets)` required | no | yes |
| full-stack E2E / lighthouse required | no | no (not in the file) |

Applying `main-protection.json` as-is would therefore do three things nobody asked for in this change:
require a second approver on every PR (a **self-lockout** for a solo maintainer), make the `check (dependencies)`
job required so the **unfixable picomatch ReDoS advisory blocks every merge** (no upstream patch exists; its
advisory range is `*`), and flip several checks to required at once. `release-deployment-safety` forbids exactly
this: a branch-protection change is a config change — "Config or infrastructure change is treated as a deploy:
version it, roll it out gradually, be able to revert it" — and "A 'successful' deploy that cuts off legitimate
access is a failed deploy." `verifiable-quality-gates` adds: "Ratchet, do not big-bang."

Two mechanical hazards also had to be closed first:

1. **Brittle required-check names.** The full-stack jobs were named with the spec list embedded
   (`e2e (full stack · E2E-02, E2E-05, …)`). A required status check is matched by the exact job name; the
   moment that list is edited, the required context silently stops reporting and **every PR blocks forever**
   waiting for a check that never runs — the "a gate that silently stops working" failure at the centre of
   `verifiable-quality-gates`.
2. **Approvals / picomatch side effects** (above).

## Decision

Make the narrow, reversible, ratcheting change: require **only** the three proven gates now, change nothing
else, and leave `main-protection.json`'s broader intent intact to apply later.

- **Stabilise the job names.** Rename `e2e-full-stack` → `e2e (full stack)` and `e2e-full-stack-sessions` →
  `e2e (full stack · safe sessions)` in `.github/workflows/e2e.yml`, dropping the spec list from the job name
  (the specs stay listed in the run step). `lighthouse (NFR-P1 · admin shell LCP)` is already spec-list-free.
  A required check now has a fixed context that a spec change cannot silently break.
- **Add a separate, additive ruleset.** `.github/rulesets/e2e-acceptance.json` is an independent ruleset that
  requires **only** the three stable contexts (`e2e (full stack)`, `e2e (full stack · safe sessions)`,
  `lighthouse (NFR-P1 · admin shell LCP)`), with `strict_required_status_checks_policy: false` (no forced
  branch-up-to-date friction) and the same admin bypass actor as `main-protection.json`. GitHub unions the
  rules of all active rulesets, so this composes with `main-protection` without modifying it. It is applied,
  rolled back, or tuned on its own.
- **Generalise the apply script.** `scripts/apply-ruleset.sh [owner/repo] [ruleset-file]` now takes an optional
  ruleset file (default `main-protection.json`, backward-compatible), so each ruleset is applied reproducibly
  and independently — `scripts/apply-ruleset.sh "" e2e-acceptance.json` applies the acceptance gates alone.
- **Leave `main-protection.json` unchanged and unapplied.** Its broader intent (1 approval + the core
  `check (*)` requirements) is deferred, not discarded, until the two prerequisites exist: a second reviewer
  in the loop (so 1-approval is not a lockout) and the picomatch advisory resolved or a documented audit
  exception (so requiring `check (dependencies)` does not jam the pipeline). That is the next ratchet step.

Rejected alternatives:

- **Apply the full `main-protection.json` now (the "broad" option).** Requires a second approver (self-lockout)
  and makes picomatch block all merges (pipeline outage). Rejected on `release-deployment-safety` ("do not let a
  deploy become an outage or a lockout") and `verifiable-quality-gates` ("ratchet, do not big-bang").
- **Edit `main-protection.json` down to match live + the 3 gates, then apply.** Would silently delete the
  team's documented intent (1 approval + core checks) from the source of truth. Rejected — defer intent, do not
  erase it.
- **Edit the live ruleset directly via the API without a committed file.** Breaks governance-as-code (live
  would drift from the repo). Rejected — the committed `e2e-acceptance.json` is the source of truth.
- **Leave the gates advisory.** The weakening path `verifiable-quality-gates` names as theater. Rejected.

## Consequences

The three proven gates become merge-blocking once `e2e-acceptance.json` is applied (an admin runs
`scripts/apply-ruleset.sh "" e2e-acceptance.json`; applying is a live branch-protection change outside this
PR). A PR that breaks sign-in, 2FA, role access, terms, the security-notice contract, or the NFR-P1 LCP budget
can no longer merge. The change is reversible in seconds (disable or delete the `e2e-acceptance-gates` ruleset).
Nothing else about merging changes: approvals stay 0, picomatch stays non-blocking, and `main-protection.json`
is untouched. The cost is one more ruleset file to keep in mind, and the standing follow-up to take the broader
`main-protection` apply once its prerequisites are met.

**Honest limits (not-assessed here):** this PR adds the config and the tooling; it does **not** itself change
live protection — that happens only when an admin runs the apply, which needs repo-admin rights. Whether the
required contexts match the live check names exactly is confirmed only after the rename lands and the next PR
reports its checks; the stable names make a future break far less likely but a first-apply verification on a
real PR is still owed.

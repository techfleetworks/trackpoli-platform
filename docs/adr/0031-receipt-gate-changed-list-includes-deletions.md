# 0031. The skill-receipt gate's changed-list includes deletions

Date: 2026-11-16

## Status

Accepted

Refines the skill-receipt gate introduced for the contributor process (see `CONTRIBUTING.md` and
`always-on/enterprise-skills-always-on.md`).

## Context

Every PR carries a skill-application receipt in `docs/skill-receipts/log.jsonl`. The `receipt` CI job
(`.github/workflows/gates.yml`) runs `check-skill-receipt.mjs`, which **diff-binds** the receipt: every
`applied` skill's `where` files must appear in the change diff, so an entry cannot claim it touched a file the
PR never touched. CI computed that diff with `git diff --name-only --diff-filter=ACMR` — **A**dded,
**C**opied, **M**odified, **R**enamed. The **D** (deleted) class was left out.

That is a structural trap for a deletion PR. When the whole point of a change is to remove a file — "remove
the dead `Banner` component" (#54), "retire `LegacyButton`" (#56) — the honest `where` for
`enterprise-architecture-standards` is the deleted file itself: the skill was applied *to* that file by
deleting it. But the deleted file is not in an `ACMR` diff, so the gate rejected the receipt with
`"where" file "src/components/ui/Banner.tsx" is not in the change diff`. Both PRs went red on exactly this.

The agent's only escapes were dishonest: cite a file the PR does not really apply the skill to, or downgrade a
genuinely-applied skill to `not-applicable` — the "mark-everything-N/A escape" the coupling check exists to
stop. A pure-deletion PR (#54 changes no `ACMR` code file at all) had no honest receipt it could write.

## Decision

- **Include deletions in the receipt job's changed-list**: `--diff-filter=ACMRD` in the `receipt` job of
  `.github/workflows/gates.yml`. A file the PR deletes is a file the PR changed, so a receipt may honestly
  cite it. `check-skill-receipt.mjs` is unchanged — it already diff-binds against whatever list it is given,
  and it tests list membership, not disk existence, so a deleted file validates correctly.
- **Leave the `arch-review` job's list as `ACMR`.** That gate greps each changed file's *contents* for
  dependency-direction evidence; a deleted file has no contents to grep, so including `D` there would be
  wrong. This ADR deliberately diverges the two lists.
- **Add a guard test** (`test/receipt-gate-deletion-aware.test.mjs`, wired into `npm test`) asserting the
  `receipt` job's filter includes `D` and the `arch-review` job's filter excludes it. Reverting either filter
  fails the test (proven by mutation: flipping `ACMRD`→`ACMR` turns the receipt assertion red), so neither
  regression can return silently.

Rejected alternatives:
- **Teach the check script to stat deleted `where` files on disk.** It would have to special-case paths that
  no longer exist and reconstruct deletion status without the diff — more logic, in the wrong layer. The diff
  already knows what was deleted; the fix belongs where the diff is computed.
- **Forbid citing deleted files; require an applied skill to name a surviving file.** A pure-deletion PR has
  no surviving code file, so this forces either a false citation or a false `not-applicable`. It institutional­izes
  the dishonesty the receipt exists to prevent.

## Consequences

Deletion PRs can now ship an honest, grounded receipt that cites the file they remove, and the coupling check
still fires on the deleted surface (a deleted UI file still forces the UI-coupled skills to `applied`). The two
changed-lists now differ by one filter class on purpose; the guard test and this ADR record why, so a future
editor does not "consistency-fix" `arch-review` to `ACMRD` and silently break content-grepping. Verified: the
new guard test passes (2/2) and discriminates (mutation to `ACMR` → 1 fail); this receipt (which cites only
added/modified files) passes `check:receipt`. Honest limit: this is proven by the guard test and local gate
runs; the end-to-end effect — #54 and #56 turning green once they merge `main` — is confirmed on those PRs.

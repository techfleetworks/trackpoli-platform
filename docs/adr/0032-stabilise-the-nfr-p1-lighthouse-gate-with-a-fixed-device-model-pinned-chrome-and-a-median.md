# 0032. Stabilise the NFR-P1 Lighthouse gate with a fixed device model, pinned Chrome, and a median

Date: 2026-11-18

## Status

Accepted

Refines the NFR-P1 performance gate introduced with the admin shell (TP1-07, P1-12): `lighthouse.config.json`,
`scripts/check-lighthouse.mjs`, and the `lighthouse` job in `.github/workflows/e2e.yml`.

## Context

The `lighthouse (NFR-P1 · admin shell LCP)` check is a blocking CI gate: the admin shell must load and be
interactive in 2.5s or less (LCP). It had been flaking red on byte-identical builds, which makes it
untrustworthy — a red that does not mean "a real regression" trains everyone to ignore it, and the
`verifiable-quality-gates` discipline says a gate whose signal is not honest is theater.

Evidence (CI artifacts pulled with `gh run download <id> -n lighthouse-results`, observed, 5 runs):

| run | lcpMs | tbtMs | perfScore | verdict |
|-----|-------|-------|-----------|---------|
| 44233089949 | 963  | 300 | 0.85 | pass |
| 44232356859 | 773  | 56  | 0.99 | pass |
| 44231332016 | 1016 | 536 | 0.74 | **FAIL (perfScore < 0.80)** |
| 44227092729 | 770  | 67  | 0.98 | pass |
| 44202355344 | 774  | 84  | 0.98 | pass |

LCP itself was stable (770–1016ms, every run far under the 2500ms budget; an earlier run showed a one-off
2971ms paint spike). What actually flipped the gate was **perfScore (0.74 → 0.99)**, driven by **TBT swinging
56 → 536ms** on byte-identical builds. Three measurement choices let shared-runner noise straight into the
verdict:

1. **Unpinned browser.** The job used the runner's auto-detected Google Chrome via `chrome-launcher`. Its
   version drifts between runs, and the Chrome version alone moves the trace and the score.
2. **A single, un-averaged run** per URL, so one flaky sample was the whole verdict.
3. **No explicit device model.** With `formFactor: "desktop"` but no `throttlingMethod`/`throttling`, the
   score reflected the raw CPU of a shared 2-vCPU runner rather than a fixed device.

Making the check advisory / non-required would be the *weakening* path and is explicitly out of scope: the
gate must stay blocking and its signal must become honest.

## Decision

Keep the gate blocking and make its measurement deterministic, without weakening what it detects:

- **Pin Chrome.** The `lighthouse` job installs a fixed Chrome-for-Testing build
  (`browser-actions/setup-chrome` pinned to commit `48ad923…` / v2.2.0, `chrome-version: 158.0.8127.36`) and
  exports `CHROME_PATH`. `chrome-launcher` honours `CHROME_PATH`, so the measurement browser no longer drifts
  and **no application code change is needed** for the pin. Both the action SHA and the Chrome version are
  pinned and bumped deliberately, never floated.
- **Fixed device model.** `check-lighthouse.mjs` forces `throttlingMethod: "simulate"` with an explicit,
  fixed `throttling` block (`rttMs: 40`, `throughputKbps: 10240`, `cpuSlowdownMultiplier: 1`) from the config.
  Lighthouse then models a fixed mid-range laptop on broadband from the trace via Lantern, instead of
  reporting the runner's raw CPU — this is the main lever on the TBT/perfScore variance.
- **Median of N.** Each URL is measured `samples` times (default 5) and the budget is checked against the
  **median** of lcpMs / tbtMs / perfScore, so a single flaky run cannot flip the gate while a sustained
  regression still does. Every per-run sample is written to `reports/lighthouse-results.json` for audit.
- **Fail closed.** A Chrome-launch failure, a missing/empty config, zero pages, or a URL that yields zero
  valid samples exits non-zero (2), never a silent exit 0. "I could not measure" and "I measured and it
  passed" are different outcomes with different exit codes.
- **A discriminating test.** `test/lighthouse-gate.test.mjs` (wired into `npm test`) runs the real check
  end to end through a test-only input seam (`CHECK_LIGHTHOUSE_SAMPLES_FIXTURE`, inert in prod/CI) that
  injects the per-run samples a live browser would produce. It proves a planted LCP / TBT / perfScore
  regression still FAILS, that a single flaky spike among healthy runs does NOT (median immunity), that a
  sustained regression is not hidden by two good runs, and the fail-closed exits. Proven to discriminate by
  mutation: no-oping the budget comparison turns 4 regression assertions red.

**The budget thresholds are unchanged** (lcpMs 2500, tbtMs 600, perfScore 0.8). The fixed device model makes
the numbers comparable run-to-run; it does not loosen them. No re-baseline was taken in this change — if a
pinned + simulated + median run still cannot reliably clear a threshold, that loosening is a separate decision
that must prove a planted regression still fails at the new number, recorded in its own ADR.

Rejected alternatives:

- **Make the check advisory / non-required.** The weakening path, explicitly out of scope. A gate nobody
  must pass detects nothing.
- **Raise the budgets to swallow the noise.** Treats the symptom, not the cause (noisy measurement), and
  blinds the gate to real regressions that fit inside the inflated headroom.
- **`throttlingMethod: "devtools"` (apply real throttling during the run).** Still reads through to the
  runner's live CPU, so it does not remove the variance simulate's trace-based model does.
- **Keep one run but discard outliers heuristically.** A median of a fixed N is simpler, auditable, and has
  a committed test proving the outlier-immunity property.

## Consequences

The gate stays blocking and its red now means a real, sustained regression rather than runner weather. The
job is slower (five Lighthouse passes instead of one) and the pinned Chrome must be bumped deliberately over
time (a stale pin is a maintenance cost, not a correctness risk). The measurement semantics of the NFR
changed — the score now models a fixed device — so a future editor must not "simplify" by deleting the
`throttling` block or dropping back to a single run; the config comments, the workflow comments, and
`test/lighthouse-gate.test.mjs` record and enforce why.

Verified: the discriminating test passes (13/13) and discriminates (budget comparison no-oped → 4 fails);
`check:architecture` and `check:links` pass locally. **Honest limit (not-assessed here):** the end-to-end
stability claim — that the gate is now reliably green across repeated CI runs on an unchanged build — is
confirmed only by iterating the `lighthouse` job on CI with the pin + simulate + median in place, since
Chrome/CI timing cannot be fully reproduced on a dev machine. simulate reduces but does not fully remove CPU
sensitivity (the underlying trace still comes from the runner); the median over N is what covers the residual
jitter, and N may need raising if CI shows it is still too tight.

# 0030. Scope Tailwind v4 content sources to app source

Date: 2026-11-16

## Status

Accepted

Extends the Tailwind v4 + shadcn wiring in [ADR-0011](0011-adopt-shadcn-ui-radix-tailwind-as-the-component-system.md).

## Context

Tailwind v4, loaded through `@import "tailwindcss/utilities.css"` in `src/app/globals.css`, turns on
**automatic content detection**: it scans the whole project for class candidates, skipping only
`.gitignore`d paths, CSS, and binary files. That sweep includes Markdown and JSON — in particular the ADRs
under `docs/adr/` and the arch-review log `docs/arch-reviews/log.jsonl`.

Those prose files contain the literal string `text-[length:var(--md-*)]`, used as shorthand in review
evidence (for example "colour via semantic utilities + text-[length:var(--md-*)], no hex"). Tailwind
extracted it as a real utility candidate and generated invalid CSS: `.text-\[length\:var\(--md-\*\)\] {
font-size: var(--md-*) }`. `--md-*` is not a valid custom-property name, so lightningcss (which Next uses to
process CSS) rejects it **at request time**. The production server (`next start`) therefore failed to serve
CSS, logging `Parsing CSS source code failed — Unexpected token Delim('*')` on every request.

Downstream: the `e2e (sign-in UI + admin shell)` job's web server never became ready and timed out after
120s, and the `lighthouse (admin shell LCP)` budget check failed. Both were red on `main` for days. The
production `next build` only **warned** (it still exited 0), so `check (lint/typecheck/unit/build)` stayed
green and the broken CSS shipped unnoticed.

## Decision

- **Disable Tailwind's automatic content detection** by passing `source(none)` on the utilities import in
  `globals.css`, and scan **only** the explicit `@source "../**/*.{ts,tsx}"` (the app's TypeScript/TSX
  source). Every Tailwind utility the app actually uses is authored in a `.ts`/`.tsx` file; CSS Modules and
  the token layer are plain CSS and define no Tailwind utilities, so nothing real is lost.
- **Add a guard test** (`test/tailwind-source-scope.test.mjs`, wired into `npm test`) that asserts
  `globals.css` keeps `source(none)` and an explicit `@source`. Reverting the fix — re-enabling the
  project-wide sweep that re-leaks prose candidates — fails the test, so the regression cannot return
  silently.

Rejected alternatives:
- **Exclude docs with `@source not "../../docs/**"`.** A denylist: the next prose directory (a new
  `reports/`, a README elsewhere) leaks again. An allowlist of real source is the robust shape.
- **Stop writing glob-like strings in prose.** Unenforceable, and it fights the arch-review log's own
  evidence style, which legitimately quotes class names.

## Consequences

The production build serves valid CSS again; the `e2e` and `lighthouse` jobs recover. Content scanning is now
an allowlist (`src/**/*.{ts,tsx}`), so a Tailwind utility referenced **only** from a non-`ts`/`tsx` file would
not be generated — acceptable, because the app authors all utilities in components and screens. Verified this
change: `next build` clean, **0** occurrences of `var(--md-*)` in the built CSS (was the parse-error source),
**145** `var(--md-body-medium-size)` references retained in the output (real token utilities still generate),
and the new guard test. Honest limit: the end-to-end recovery is proven by a local production build and output
inspection, not yet by a green `e2e` run on CI — that is confirmed on the pull request.

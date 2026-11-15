# 0018. Apply the "Bold Pines" brand: Light/Dark semantic tokens and the Mulish/Figtree/Geist type scale

Date: 2026-11-13

## Status

Accepted

Builds on [ADR-0011](0011-adopt-shadcn-ui-radix-tailwind-as-the-component-system.md) (shadcn/ui + the
token-swap architecture) and completes the colour path left open by
[ADR-0006](0006-admin-ui-material-design-3-hand-built-components-and-grayscale-tokens.md), whose grayscale
token VALUES this ADR replaces. The architecture (one colour home in `src/styles/tokens.css`; shadcn
semantic vars mapped onto it) is unchanged; only token values, fonts, radius, and the type scale change.

## Context

The brand design system ("Bold Pines") was built and signed off in Figma
(file `4ktuHgniF8G2HU4Ovzj6gi`): a fixed palette, a Light/Dark semantic mapping, a flat radius scale, and a
responsive type scale on Mulish/Figtree/Geist Mono. ADR-0006 deliberately shipped grayscale token values
with the brand "applied later by a token-value swap, no component changes"; ADR-0011 kept that swap path
when it adopted shadcn/ui. This ADR is that swap: it brings the Figma design system into the code exactly as
specified, so shadcn primitives and the hand-built screens both adopt the brand without being rewritten.

The user chose the scope (foundation + custom variants) and the typography source of truth (the responsive
**20px-EM** spec, not the file's 16-base px text styles). This ADR covers the foundation; the custom
component variants (coloured toasts, the Card Type×Color matrix, hover-card colours, the table actions
column, button disabled-all-sizes) follow in later PRs on top of it.

## Decision

- **Palette primitives** (the only hex in the app) in `src/styles/tokens.css`: Pine `#135734`, Dark Pine
  `#1c352a`, Slate `#33403a`, Sage `#b9cdbd`, Mist `#eef2ee`, Coral `#ff6246`, Destructive Orange
  `#7c2d12`, plus Dark Pine Translucent (Dark Pine @ 40%) and Coral Translucent (Coral @ 40%).
- **Semantic mapping** onto the shadcn vars, Light in `:root` and Dark under `.dark` (class-based, opt-in,
  not `prefers-color-scheme`, per ADR-0011): e.g. background Mist/Dark Pine, foreground Dark Pine/Mist,
  primary Pine (both) with Mist text, secondary Sage/Slate, muted Sage/Slate, destructive Dark Orange
  (both) with Mist text, ring Pine/Sage.
- **Borders** (`--border`/`--input`) use **Dark Pine Translucent**, per the design-system decision that all
  component strokes are Dark Pine Translucent (this overrides Figma's Sage/Slate `border` role value).
- **`--md-*` roles re-pointed** from grayscale to the brand so the hand-built auth/shell/settings screens
  adopt Bold Pines with no rewrite; the MD3 type-scale sizes and shape vars are untouched (a screen
  migration is a later pass, ADR-0011 D5).
- **Radius**: flat `4 / 8 / 12 / 16` for `sm/md/lg/xl` in the `globals.css` `@theme`, replacing the
  calc()-from-base derivation, to match the design system exactly.
- **Type**: Mulish (headings), Figtree (body/UI), Geist Mono (code) via `next/font`, replacing Roboto. A
  responsive root `font-size: clamp(20px, 18px + 0.6vw, 24px)` makes 1rem = 20px→24px; the ramp
  (display/h1–h4/lead/body/small/detail) lives in the token layer and is applied as base element styles.
  Spacing is unchanged — Tailwind v4's 4px scale already equals the design-system spacing tokens.

Rejected alternatives:
- **The file's 16-base px text styles** — the user explicitly chose the responsive 20px-EM system for
  accessibility (larger default body, zoom-safe rem/em).
- **Restyling the hand-built screens now** — out of this pass's scope; re-pointing `--md-*` adopts the
  brand everywhere at once, and the bespoke migration is tracked separately.
- **Wiring dark mode to `prefers-color-scheme`** — would flip colours for dark-OS users with no in-app
  control and break ADR-0011's no-surprise rule; dark stays opt-in via `.dark`.

## Consequences

The whole app re-themes from grayscale to Bold Pines through one token file, as ADR-0006 planned; a future
theme change stays a value swap. Verified: `tsc --noEmit`, `check:architecture`, `check:design-system
--changed`, and `next build` all pass on this change.

Honest limits / follow-ups:
- **Border contrast (deliberate, accepted).** Per the design-system decision, all component strokes use
  Dark Pine Translucent. Over Mist this resolves to ~`#9aa6a0`, ~2.2:1 against the surface — BELOW WCAG
  1.4.11's 3:1 for component boundaries — and near-invisible on the Dark-Pine dark background. This is an
  accepted product-owner decision (decorative hairline; components are identified by fill + label, and the
  Pine focus ring, ~7.6:1, carries interaction state). Recorded as fail-accepted for the resting border in
  `a11y-conformance.json` (1.4.11), with a human a11y pass and a dark-mode border fallback flagged for
  follow-up. Text contrast is unaffected: every semantic text/surface pair is ≥7:1 (AAA), proven by
  `src/styles/theme-contract.test.ts`.
- **Coral on a surface** cannot reach AAA for body text; Coral is used as a decorative accent only.
- The hand-built screens now render in brand colour but keep their MD3 layout/sizing until their own
  migration PRs.

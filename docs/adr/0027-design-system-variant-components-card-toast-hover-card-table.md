# 0027. Design-system variant components: Card, Toast, Hover Card, Table

Date: 2026-11-14

## Status

Accepted

Builds on [ADR-0026](0026-apply-bold-pines-brand-light-dark-semantic-tokens-and-the-mulish-figtree-geist-type-scale.md)
(the Bold Pines token foundation) and [ADR-0011](0011-adopt-shadcn-ui-radix-tailwind-as-the-component-system.md)
(compose shadcn/ui primitives).

## Context

The Figma design system defines custom component variants beyond the stock shadcn primitives: coloured
toasts, a Card colour×type matrix, coloured hover cards, a table with an actions column, and a button whose
disabled state covers every size. The code had `button`, `input`, `label`, and `alert` in
`src/components/ui/` but no `card`, `toast`, `hover-card`, or `table`, so those primitives had to be built
before the variants could exist in code.

## Decision

- **Build the four missing primitives** in `src/components/ui/`, themed from the ADR-0026 tokens, colour via
  utilities only (no hex): `card.tsx`, `toast.tsx`, `hover-card.tsx` (Radix HoverCard), `table.tsx`
  (semantic `<table>` elements).
- **Encode colour as a CVA variant** (`color` / `variant`) on Card, Hover Card, and Toast, mapping to the
  palette per the Figma **Color Usage** decision set: Pine/Slate/Dark-Pine surfaces take Mist text; Mist
  takes Dark Pine; **Coral is a decorative surface** (Dark Pine text, below 7:1 — Coral carries no AAA text
  by design). Borders use `--input` (Dark Pine Translucent), per ADR-0026.
- **Expose the brand palette as colour utilities** (`--color-pine/dark-pine/slate/sage/mist` in the
  `globals.css` `@theme`, alongside the existing `--color-coral`) so the fixed-colour variants never need a
  hex literal. Documented as palette primitives for design-mandated colours; semantic roles stay the default
  for normal UI.
- **The Card "type" dimension (Button / Photo / Avatar) is composition**, not a prop: compose `CardImage`
  for a photo card, a rounded `<img>` in `CardHeader` for an avatar card, and `CardFooter` + `Button` for a
  button card. This keeps the primitive idiomatic (shadcn cards compose) rather than enumerating a 12-cell
  prop matrix.
- **Toast is a presentational primitive** (role=status, icon slot to the left of the header), not a
  queue/provider; the icon is composed by the caller (any lucide icon).
- **The table "actions column" is composition**: a trailing `TableHead` plus a `TableCell` holding a
  `Button variant="ghost" size="icon"`.
- **Button disabled across all sizes needs no new code**: the base `buttonVariants` already applies
  `disabled:opacity-60 disabled:cursor-not-allowed` to every variant and size; pinned by a test.

Rejected alternatives:
- **A `type` prop enumerating the 12-cell Card matrix** — less idiomatic than composition and duplicates
  layout logic; composition keeps one Card with a `color` variant.
- **Adding `sonner` for toasts** — a new runtime dependency for a presentational surface; the design calls
  for the toast's look, which a primitive covers. A full notifier can wrap it later.

## Consequences

The design-system variants exist in code, token-driven and verified: `tsc`, `next build`,
`check:architecture`, `check:design-system`, and 10 RTL tests pass; a fresh-context `judge-arch` review
covers the new files. Honest limits: the palette colour utilities can be misused to bypass semantic roles
(mitigated by an in-file comment and the "semantic-first" guidance, and still gated by the no-hex rule);
Coral-surface text is decorative and below 7:1 by design; and the toast is a visual primitive only (no
queue/stacking yet).

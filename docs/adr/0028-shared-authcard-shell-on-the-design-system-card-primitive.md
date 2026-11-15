# 0028. Shared AuthCard shell on the design-system Card primitive

Date: 2026-11-14

## Status

Accepted

Executes the expand/contract migration of [ADR-0011](0011-adopt-shadcn-ui-radix-tailwind-as-the-component-system.md)
(D5) and builds on [ADR-0027](0027-design-system-variant-components-card-toast-hover-card-table.md) (the Card
primitive).

## Context

Nine auth screens (sign-in, forgot-password, forgot-password-sent, reset-password, confirm, account-locked,
MFA enrol, MFA verify, session-expired) each imported the hand-built `authCard.module.css` directly for the
same shell: the centred page, the card surface, the TrackPoli brand lockup, and a footer note. That CSS
Module is exactly the kind of hand-rolled shell the design-system migration (ADR-0011 D5) retires in favour
of the primitives. There was no shared component, so the shell markup was duplicated across the nine screens.

## Decision

- **Introduce a shared `AuthCard` component** (`src/features/auth/AuthCard.tsx`) built on the design-system
  `Card` primitive. It renders the centred page (`bg-muted`), the card surface (`Card`, `bg-card`), and the
  brand lockup (`bg-primary` mark + `text-foreground` name), with a `brandCentered` option and an
  `AuthCardFooter` for the footnote. Colour comes from semantic token utilities only — no CSS Module and no
  colour literal in feature code (decisions.md). The card keeps its MD3 shape/elevation via the retained
  `--md-shape-card` / `--md-elevation-card` tokens, so the visual shell is preserved.
- **Migrate all nine screens** to `AuthCard` and **delete `authCard.module.css`** in the same change (the
  contract step: the shared module has zero importers afterward).
- Each screen keeps its own per-screen layout module for now; those are retired in later per-screen PRs.
  Screens whose card was a `<form>` keep the form as the gap-flow child of `AuthCard`.

Rejected alternatives:
- **Per-screen migration without a shared component** — would duplicate the shell nine times and leave the
  module alive longer; a shared `AuthCard` is the single owner of the shell.
- **Putting AuthCard in `src/components/ui/`** — it is an auth-specific composition of the generic `Card`
  primitive, so it belongs in the auth feature, not the primitive layer.

## Consequences

The auth shell has one owner, the shared module is gone, and the screens are smaller. Verified: `tsc`,
`next build`, the auth test suite (163 tests) and a new `AuthCard` test, `check:architecture` and
`check:design-system` all pass; a fresh-context `judge-arch` review covers the change. Honest limits: each
screen still has its own per-screen `*.module.css` for content layout (retired in later PRs), and the card
radius/elevation still reference the MD3 tokens rather than the design-system radius scale, to preserve the
current look.

# 0029. Add a --scrim token and keep the hand-built session-warning alertdialog

Date: 2026-11-15

## Status

Accepted

Continues the per-screen design-system migration ([ADR-0011](0011-adopt-shadcn-ui-radix-tailwind-as-the-component-system.md)
D5) and extends the brand token foundation ([ADR-0026](0026-apply-bold-pines-brand-light-dark-semantic-tokens-and-the-mulish-figtree-geist-type-scale.md)).

## Context

Migrating `SessionWarningDialog` (and, next, `settings/security/TwoFactorCard`) off their CSS Modules
onto design-system utilities surfaced a colour with no token: the modal scrim `rgba(0, 0, 0, 0.32)`. The
exact literal appears in **both** `SessionWarningDialog.module.css` and `TwoFactorCard.module.css`. The
`check:design-system` gate forbids a colour literal outside `src/styles/tokens.css`, so the scrim cannot
move into feature code as-is, and duplicating it in two component files is exactly the debt the single
colour home exists to prevent.

The shadcn `Dialog` primitive already exists and its `DialogOverlay` scrims with `bg-foreground/40`
(Dark Pine at 40% in light mode), which is a **different colour and opacity** than the pure-black 32% these
modals use. `SessionWarningDialog` is also a `role="alertdialog"` with a hand-written focus trap, focus-on-
open and focus-restore that are asserted by `SessionWarningDialog.test.tsx`.

## Decision

- **Add a `--scrim` semantic token** to `src/styles/tokens.css` (`rgba(0, 0, 0, 0.32)`, theme-independent;
  `.dark` inherits the same value) and expose it as the `bg-scrim` utility via `--color-scrim` in
  `globals.css` `@theme`. It is the one home for the scrim colour, reused by both modals.
- **Keep the hand-built `SessionWarningDialog`** overlay/dialog and migrate it class-for-class to utilities
  (`bg-scrim`, `bg-card` for `--md-surface-container-lowest`, `bg-muted` for `--md-surface-container-high`,
  `rounded-[var(--md-shape-card)]`, `shadow-[var(--md-elevation-card)]`), preserving every value so there is
  no visual change. Delete `SessionWarningDialog.module.css` (and `TurnstileSlot.module.css`, migrated in the
  same change).

Rejected alternative:
- **Adopt the shadcn `Dialog` primitive here** — its overlay scrim (`bg-foreground/40`) would change the
  scrim colour and opacity (a visual change), and replacing the tested alertdialog focus-trap/portal
  behaviour is a real refactor with its own risk. That is out of scope for a presentation-only migration; the
  scrim token is the smaller, no-visual-change change that still removes the duplicated literal.

## Consequences

The scrim colour has one home and both modals (this PR's `SessionWarningDialog`, the next PR's
`TwoFactorCard`) read it through `bg-scrim` with no literal in feature code. The session-warning dialog keeps
its alertdialog semantics and focus behaviour unchanged. Verified: `tsc`, `next build`, the
`SessionWarningDialog`/`TurnstileSlot` suites, `check:architecture` and `check:design-system`, and a
fresh-context `judge-arch` review. Honest limits: no-visual-change is proven at the token level (every
swapped utility resolves to the identical value), not by a rendered pixel diff; the P1-16 human/axe pass
still owes the real-browser check. `TwoFactorCard` still references the scrim literal until its own PR lands;
this ADR introduces the token it will adopt.

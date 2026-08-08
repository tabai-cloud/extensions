---
title: Ownership button/badge styling and hover/focus affordance
used_by:
  - packages/claude-tracker/lib/request-ownership-ui.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Ownership badge hover affordance <a id="ownership-badge-hover-affordance"></a>

### packages/claude-tracker/lib/request-ownership-ui.ts — ensureStylesInjected

A real stylesheet, not inline styles: an early version used
`button.style.cssText` with `opacity: 0.75` and no background at all,
which visually merged with claude.ai's own row text underneath (the
sidebar masks/fades its title text right where these hover-reveal
controls sit — see `findSidebarTargets`'s own doc comment — so a
translucent button let that faded text show straight through). A solid
background per color scheme, plus an explicit stacking context (position
+ z-index), fixes both the legibility issue and any future stacking
surprise from claude.ai's own layered UI — cheap insurance even though
piggybacking on the "more options" trigger's own wrapper (see
`claude-dom-mount-surfaces`) hasn't shown a real stacking bug so far.

At rest, each element shows only its icon glyph (🔒/✅) — compact enough
to sit unobtrusively wherever it's mounted. Hovering the ROW — not just
the icon itself, which is a small target — swaps to the label text
instead, same full-text look this had before icons were added. The
trigger is `[data-row]:hover` / `tr[data-hoverable]:hover` (claude.ai's
own two row selectors), which, like any CSS `:hover` on an ancestor, is
already true whenever the pointer is over ANY descendant, not just that
exact element — an earlier version keyed this off `:hover` on the
button/badge itself, which only worked if the pointer happened to land
exactly on the (small, icon-sized) element. `:focus` stays scoped to the
element itself: keyboard tabbing lands directly on the button, with no
equivalent "row" concept to key off. A button carrying
`FORCED_LABEL_ATTR` (its pending/done/error click states — see
`createRequestOwnershipButton`) always shows its label regardless of
hover: those are short-lived, user-initiated status messages the click
itself already has the user's attention for, not a rest state that needs
to stay compact.

Injected once per content-script lifetime, into the real page DOM
(content scripts share the page's DOM even in the isolated JS world),
not per-button — every button/badge just references the shared class
names.

### packages/claude-tracker/lib/request-ownership-ui.ts — setButtonState

Updates both the visible label text and the `aria-label` (the button is
icon-only at rest — see `ensureStylesInjected` — so assistive tech needs
the state spelled out even when hover/focus isn't active) in one place,
and toggles `FORCED_LABEL_ATTR`: idle is the only state that collapses to
just the rest icon on mouse-out; every other state is short-lived,
user-initiated feedback that stays as text regardless of hover.

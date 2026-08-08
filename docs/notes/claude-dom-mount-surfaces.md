---
title: claude.ai's two chat-list surfaces need different DOM mount strategies
used_by:
  - packages/claude-tracker/lib/request-ownership-ui.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## claude.ai DOM mount surfaces <a id="claude-dom-mount-surfaces"></a>

### packages/claude-tracker/lib/request-ownership-ui.ts — module overview

Two distinct surfaces on claude.ai render the same chat list with
genuinely different markup, confirmed live against a real logged-in
session (not assumed from either surface's outward appearance):

- **The left sidebar**: `<div data-row>` wraps a main-button element
  carrying `data-row-main-button` — for a real chat row this is an
  `<a href="/chat/{uuid}">`, but `[data-row]` is NOT chat-specific (it's
  claude.ai's generic list-row component, also used for non-chat rows
  elsewhere in the sidebar, one of which renders its main-button as a
  plain `<button>` with no href at all). So the id is read primarily off
  a `data-row-key="chat:{uuid}"` attribute on an ancestor of the row (see
  `chatIdFromRowKey` for the `"chat:"` prefix), falling back to the
  main-button's own href only if that ancestor isn't present. Either way,
  a row that yields no id (a non-chat `[data-row]`) is silently skipped —
  see `findSidebarTargets`. The "more options" trigger
  (`[data-row-action]`) is a separate, absolutely-positioned trailing
  `<div>` (own `opacity-0 group-hover:opacity-100`, overlaid on top of
  the row's right edge) — confirmed live: an element mounted next to it
  is invisible at rest, same root cause as the `/chats` wrapper below (an
  earlier version of this file mixed this row up with a different,
  non-chat `[data-row]` variant that genuinely has no wrapper, and
  wrongly generalized from that). So this surface mounts into the
  main-button's own flex row instead — the `<a data-row-main-button>`
  itself is `display: flex` (icon + title as its two existing children),
  so appending a third item there is normal flex layout, not
  absolute-position guesswork, same reasoning as `/chats` below.
- **The `/chats` full-list page**: a real `<table data-cds="Table">` —
  each `<tr data-hoverable>` has a title cell containing an
  `<a href="/chat/{uuid}">` and a separate, zero-width actions cell whose
  "more options" trigger (`button[aria-haspopup="menu"]`) sits inside its
  own wrapper `<div>` carrying `opacity-0
  group-hover/cdsrow:opacity-100` — unlike the sidebar, this IS a real
  wrapper, and CSS opacity on a parent composites its entire subtree at
  that alpha with no way for a child to opt back out. An element inserted
  next to that trigger (`findChatsTableTargets`' old approach) is
  therefore invisible at rest, not just unstyled — confirmed live. So
  this surface mounts into the title cell's own flex row instead (real
  layout width, never opacity-hidden), found by walking siblings from the
  title anchor rather than matching claude.ai's own Tailwind class names,
  which are far more liable to drift.

Both adapters return a `mount` callback (not a fixed insertion element)
so each surface's own DOM quirks stay fully self-contained here —
`request-ownership.content.ts` just calls `target.mount(element)`.

### packages/claude-tracker/lib/request-ownership-ui.ts — chatIdFromRowKey

Strips the `"chat:"` prefix a sidebar row's `data-row-key` carries — the
operator/Convex side stores/looks up the bare conversation id (see
ai-cloud-agent's own registration calls), not this UI-only keying scheme.
Returns `null` for a present-but-non-chat key (e.g. a `"project:"` row)
so callers skip it same as a missing key entirely.

### packages/claude-tracker/lib/request-ownership-ui.ts — findSidebarTargets

Rows without a resolvable chat id (see the module overview above —
`[data-row]` also covers non-chat rows) are left unmarked and
unprocessed, not just skipped-once: a later scan gets another chance at
them, in case whatever made them unresolvable this pass was transient
(e.g. still mid-render). Falls back to the old
before-the-more-options-trigger mount if `mainButton` isn't a real
element to append into (shouldn't happen — `querySelector` always
returns an `Element` or `null`, and the null case is already filtered
above — but keeps the fallback shape consistent with
`findChatsTableTargets`' own defensive one below).

### packages/claude-tracker/lib/request-ownership-ui.ts — findChatsTableTargets

`titleFlexRow` (the title cell's own flex row — see the module overview
above) is found by walking from the title anchor: its next sibling is a
`<span class="contents">` (a no-box wrapper — its children ARE the
cell's real layout), whose first child is the flex row itself, holding
`[icon+title, relative-time]` as its two existing items. Appending a
third item there is normal flex layout, not absolute-position
guesswork. Falls back to the old before-the-more-options-trigger mount
if that structure isn't found (an unexpected claude.ai markup change) —
degrades to the pre-fix, hover-only behavior rather than silently
dropping the button/badge entirely.

---
title: Why the ownership scan re-runs on claude.ai's SPA navigation
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## claude.ai SPA rescan <a id="claude-spa-rescan"></a>

### packages/claude-tracker/entrypoints/request-ownership.content.ts — scan()

`scan` finds every not-yet-processed row across both surfaces and injects
a button or badge into each, per the current `ownedIds` snapshot. Safe to
call repeatedly (`findSidebarTargets`/`findChatsTableTargets` both mark
rows they return as processed via a data attribute), so this runs once at
startup and again on every observed DOM mutation — claude.ai is a
client-routed SPA, so the sidebar/table content is swapped in and out
long after this content script's initial run.

### packages/claude-tracker/entrypoints/request-ownership.content.ts — MutationObserver

`requestIdleCallback`-debounced: claude.ai's own React tree can mutate
the DOM many times per render pass, and re-querying both surfaces on
every single one of those is wasted work — a scan is idempotent, so
coalescing rapid-fire mutations into one idle-time pass costs nothing
correctness-wise.

### packages/claude-tracker/entrypoints/request-ownership.content.ts — wxt:locationchange

Belt-and-suspenders: history-API navigations (claude.ai's own
client-side routing) don't always trigger a `childList` mutation on
`document.body` in the same tick — see `WxtWindowEventMap`'s own doc
comment on this event.

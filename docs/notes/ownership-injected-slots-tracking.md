---
title: injectedSlots tracks mount state separately from row processing
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## injectedSlots tracking <a id="ownership-injected-slots-tracking"></a>

### packages/claude-tracker/entrypoints/request-ownership.content.ts

`injectedSlots` tracks every row this content script has put a button or
badge into, keyed by resourceId — separate from
`findSidebarTargets`'/`findChatsTableTargets`' own processed-row marking
(which only gates whether a row gets a first element at all). This is
what lets `reconcileOwnership` upgrade an already-injected button to a
badge in place once `ownedIds` catches up, without re-running either
surface's own DOM query.

---
title: A button only ever upgrades to a badge, never downgrades
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Ownership badge is a one-way upgrade <a id="ownership-badge-one-way-upgrade"></a>

### packages/claude-tracker/entrypoints/request-ownership.content.ts

`reconcileOwnership` upgrades any already-injected button to a badge once
`ownedIds` says its resourceId is now owned — the only direction this
ever flips. Nothing in this extension's own flow revokes access
mid-session, so a badge is never downgraded back to a button.

---
title: A button only ever upgrades to a badge, never downgrades
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
  - packages/claude-tracker/lib/request-ownership-ui.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Ownership badge is a one-way upgrade <a id="ownership-badge-one-way-upgrade"></a>

### packages/claude-tracker/entrypoints/request-ownership.content.ts

`reconcileOwnership` upgrades any already-injected button to a badge once
`ownedIds` says its resourceId is now owned — the only direction this
ever flips. Nothing in this extension's own flow revokes access
mid-session, so a badge is never downgraded back to a button.

### packages/claude-tracker/lib/request-ownership-ui.ts

`createOwnershipBadge` marks a chat the user already has tracked access
to — a checkmark icon at rest, expanding to "Acesso concedido" on
hover/focus. See `request-ownership.content.ts`'s
`ownedIds`/`reconcileOwnership` for how a row gets upgraded from the
request button to this badge once an admin approval (or the original
auto-claim) is reflected in the next ownership refresh.

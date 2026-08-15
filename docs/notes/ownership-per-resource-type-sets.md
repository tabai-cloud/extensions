---
title: Owned-id snapshots are per resource type, never one flat set
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Owned ids per resource type <a id="ownership-per-resource-type-sets"></a>

### packages/claude-tracker/entrypoints/request-ownership.content.ts

claude.ai's sidebar and `/recents` table list two different things side by
side: chats (`/chat/{uuid}`) and cowork sessions (`/cowork/{cse_id}`), which
the operator and Convex track as two separate `type`s under the same
`source: "claude"`. So this file keeps one `Set` per resource type rather than
one flat set of ids.

Three reasons it can't be flattened:

- `listOwnership` is answered per `(source, type)` — there is no call that
  returns "everything this workload owns" across types, so one flat set would
  have to merge two answers and could never un-merge them.
- Two types don't share an id namespace. A flat set would let ownership of a
  chat mark a cowork session as owned if their ids ever collided — a
  `cse_`-prefixed id and a UUID can't collide today, but nothing enforces that
  and the failure mode is silent: a *wrongly granted* badge, not a visible
  error.
- Each type's refresh has to fail independently. `listOwnership` returns
  `null` for a failed call (distinct from `[]` — see `ownership-null-vs-empty`),
  and one type's failure must leave the other type's good snapshot alone.
  `refreshOwnedIds` therefore `continue`s per type instead of returning early,
  and only reconciles the DOM once both have been attempted.

`injectedSlots` is keyed `"{type}:{id}"` for the same reason: the key has to
identify a resource, and an id alone doesn't.

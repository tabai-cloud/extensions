---
title: Ownership requests are idempotent on the Convex side
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
  - packages/claude-tracker/lib/request-ownership-ui.ts
  - packages/shared/src/ownership.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Ownership request is idempotent server-side <a id="ownership-request-idempotent"></a>

### packages/claude-tracker/entrypoints/request-ownership.content.ts

`ownedIds` is this content script's own snapshot of "resourceIds the
operator says this user already has tracked access to" — refreshed via
`refreshOwnedIds`, never mutated directly by a click. A successful
request creates a pending Convex row, not an ownership grant (see
`convex/integrationOwnershipRequests/mutations.ts#create`), so a clicked
button becomes "Solicitado", not a badge, until a later refresh actually
observes the grant post-approval.

### packages/claude-tracker/lib/request-ownership-ui.ts

`createRequestOwnershipButton` builds one `<button>` with its own inline
pending/done/error state — no shared/global state, and no pre-check
against Convex for whether this resourceId was already requested.
Duplicate inserts are silently deduped server-side (see
`convex/integrationOwnershipRequests/mutations.ts#create`), so an
optimistic per-click button is enough.

### packages/shared/src/ownership.ts

`source`/`type`/`resourceId` are plain caller-supplied strings, not an
enum — generic across resource kinds, matching the Convex table and
operator route this calls into. Idempotent on the Convex side (a
duplicate request for the same `(userId, source, type, resourceId)` is
silently ignored, not an error — see
`convex/integrationOwnershipRequests/mutations.ts#create`), so this
never needs to check first.

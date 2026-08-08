---
title: Ownership requests are idempotent on the Convex side
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
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

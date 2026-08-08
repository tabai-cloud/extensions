---
title: "listOwnership: null (failure) is distinct from an empty array"
used_by:
  - packages/shared/src/ownership.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## listOwnership null vs. empty <a id="ownership-null-vs-empty"></a>

### packages/shared/src/ownership.ts

`listOwnership` GETs this workload's own operator-local
`GET /workloads/{name}/integrations/ownership` endpoint (see
ai-cloud-operator's
`internal/api.Server#handleListIntegrationOwnership`) — every resourceId
Convex has on record as already owned by this workload's user for the
given `(source, type)` pair, across every workload that user has ever
run. Drives the "already have access" badge in claude-tracker's own
content script (see `request-ownership.content.ts`) — a `null` return
(config not loaded yet, or the call failed) is deliberately distinct
from an empty array (genuinely owns nothing yet), so the caller can
leave its previous snapshot untouched on a transient failure instead of
flashing every badge back to a button — same "failed fetch changes
nothing" convention ai-cloud-agent's own `OwnershipCache` poll loop
uses.

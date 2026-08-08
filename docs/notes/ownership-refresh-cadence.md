---
title: "Ownership refresh cadence: why 90 seconds"
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Ownership refresh cadence <a id="ownership-refresh-cadence"></a>

### packages/claude-tracker/entrypoints/request-ownership.content.ts

`OWNED_IDS_REFRESH_MS` (90 seconds) loosely matches the operator's own
resync cadence — ai-cloud-agent's `OwnershipCache` polls every 45-75s, and
an approval takes up to that long to reach Convex's own read path
regardless of how often this refetches, so refreshing much faster than
that would just be extra load for no fresher an answer.

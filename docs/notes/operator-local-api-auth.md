---
title: Every operator call is local, never straight to Convex
used_by:
  - packages/shared/src/report.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Operator-local API auth <a id="operator-local-api-auth"></a>

### packages/shared/src/report.ts

`reportSamples` POSTs samples to this workload's own operator-local
`POST /workloads/{name}/extension/report` endpoint (see
ai-cloud-operator's `internal/api.Server#handleExtensionReport`) — never
Convex directly, and authenticated by a per-workload local secret only
this operator and this workload's own extension ever hold, not a
Convex-facing credential.

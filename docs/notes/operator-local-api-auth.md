---
title: Every operator call is local, never straight to Convex
used_by:
  - packages/shared/src/report.ts
  - packages/shared/src/ownership.ts
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

### packages/shared/src/ownership.ts

`requestOwnership` POSTs to this workload's own operator-local
`POST /workloads/{name}/integrations/ownership/requests` endpoint (see
ai-cloud-operator's
`internal/api.Server#handleCreateIntegrationOwnershipRequest`), never
Convex directly — same auth/routing shape as `reportSamples` in
`report.ts`. Unlike `reportSamples`, this isn't fire-and-forget: it's the
direct backend of a user-initiated "Solicitar acesso" button click (see
claude-tracker's `entrypoints/request-ownership.content.ts`), so the
caller needs a real success/failure signal to reflect back in the
button's own state, not just a `console.error`.

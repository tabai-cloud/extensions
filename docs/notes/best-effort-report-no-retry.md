---
title: Metric reporting has no retry/backoff by design
used_by:
  - packages/shared/src/report.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Best-effort report, no retry <a id="best-effort-report-no-retry"></a>

### packages/shared/src/report.ts

Best-effort: a failed report is logged, not thrown. The caller's own
`chrome.storage.local` counters are unaffected either way, and the next
scheduled report (the next message-send, or the periodic alarm heartbeat
each package's own `entrypoints/background.ts` runs) carries the
current, still-correct cumulative values — the same self-healing "try
again next tick" resilience the operator's own metrics reporting already
relies on (see ai-cloud-operator's `internal/metrics.ExtensionCache`), so
there's no retry/backoff logic to duplicate here. Shared verbatim by
every package in this monorepo — reporting is entirely site-agnostic.

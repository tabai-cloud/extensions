---
title: parseUsage supports two claude.ai response shapes
used_by:
  - packages/claude-tracker/lib/claude-api.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Claude usage response shapes <a id="claude-usage-response-shapes"></a>

### packages/claude-tracker/lib/claude-api.ts

`parseUsage` ports lugia19/Claude-Usage-Extension's
`shared/dataclasses.js` — `UsageData.fromAPIResponse`/`parseNewLimits`:
it prefers the newer, authoritative `limits` array
(`{kind, percent, scope}`) when present, falling back to the older
top-level `five_hour`/`seven_day`/`seven_day_sonnet`/`seven_day_opus`
fields otherwise. Claude's own API has shipped both response shapes at
different times with no version header to branch on ahead of time, so
both are handled rather than assuming only the current one will ever
show up. `weeklyFable` has no old-format fallback — the old shape
predates Fable's own scoped weekly limit existing at all.

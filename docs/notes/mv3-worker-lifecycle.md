---
title: MV3 service-worker lifecycle constraints
used_by:
  - packages/claude-tracker/entrypoints/background.ts
  - packages/gpt-tracker/entrypoints/background.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## MV3 service-worker lifecycle <a id="mv3-worker-lifecycle"></a>

### packages/claude-tracker/entrypoints/background.ts — lastKnownOrgId

`lastKnownOrgId` is a module-scope cache only — `chrome.storage.local`
isn't needed here since a fresh orgId is always recoverable from the
`lastActiveOrg` cookie (see `discoverOrgId`), so losing this on a
service-worker restart costs at most one skipped heartbeat tick, not a
real gap.

### packages/claude-tracker/entrypoints/background.ts — heartbeat alarm

The periodic heartbeat is the only thing this background entrypoint does
now — no webRequest listener at all. `chrome.alarms` is the MV3-correct
way to get a guaranteed wake-up point; `setInterval` doesn't survive
worker suspension.

### packages/claude-tracker/entrypoints/background.ts — config warm-up

The config cache is warmed as soon as the worker starts, rather than
waiting for the first alarm tick to discover whether this workload was
actually enrolled.

### packages/gpt-tracker/entrypoints/background.ts

The `chrome.runtime.onMessage` listener is registered synchronously at
the top level, same reasoning as claude-tracker's own alarm/message
listeners: re-arms correctly on every MV3 service-worker wake.
`chrome.runtime.sendMessage` from `gpt-relay.content.ts` is what actually
wakes a dormant worker to deliver this in the first place.

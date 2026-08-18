---
title: MV3 service-worker lifecycle constraints
used_by:
  - packages/claude-tracker/entrypoints/background.ts
  - packages/gpt-tracker/entrypoints/background.ts
  - packages/gpt-tracker/entrypoints/gpt-relay.content.ts
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
worker suspension. Arming it is not unconditional, though — see
[heartbeat-alarm-create-resets-schedule](heartbeat-alarm-create-resets-schedule.md)
for why re-creating it on every wake stopped it firing entirely.

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

### packages/gpt-tracker/entrypoints/gpt-relay.content.ts

This ISOLATED-world content script (WXT's default) shares chatgpt.com's
page `window` with `gpt-signal.content.ts`'s MAIN-world script, but
unlike that one, this script keeps normal extension privileges. Its only
job is to bridge `window.postMessage` -> `chrome.runtime.sendMessage`,
into the background service worker. Unlike this repo's original
`relay.ts` (which wrote straight to `chrome.storage.local` specifically
to dodge a cold MV3 service worker silently dropping a
`chrome.runtime.sendMessage`), this DOES route through the background:
`chrome.runtime.sendMessage` reliably wakes a dormant MV3 service worker
to receive it, and the background needs to be the one making the
authenticated report call to the operator anyway (content scripts have
no business holding the operator's local secret or making that call
themselves) — keeping every operator-facing HTTP call centralized in one
place, the same as claude-tracker's design.

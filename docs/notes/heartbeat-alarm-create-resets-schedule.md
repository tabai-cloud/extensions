---
title: chrome.alarms.create resets an existing alarm's schedule
used_by:
  - packages/claude-tracker/entrypoints/background.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Heartbeat alarm: create() resets the schedule <a id="heartbeat-alarm-create-resets-schedule"></a>

### packages/claude-tracker/entrypoints/background.ts — ensureHeartbeatAlarm

`chrome.alarms.create(name, ...)` is **not** a no-op when an alarm of that
name already exists. Chrome cancels the existing alarm and replaces it with
a new one, which restarts the countdown from zero. An earlier comment here
claimed the opposite ("idempotent … safe to call on every wake") and that
claim is what let the bug below survive review.

The background entrypoint's body re-executes on **every** MV3
service-worker wake, so an unconditional `create()` there re-armed the
heartbeat every time anything woke the worker.

What woke it: `request-ownership.content.ts` calls `listOwnership` every
`OWNED_IDS_REFRESH_MS` (90 s) from any open claude.ai tab, and MV3 tears the
worker down after ~30 s idle. So the worker restarted roughly every 90 s,
the 15-minute alarm was reset ~10x per period, and
`HEARTBEAT_ALARM_NAME` **never fired at all** while a claude.ai tab was
open — the only conditions under which it did fire were the ones where
nobody was using claude.ai in a tab.

`claude.usage.*` is the only metric family produced by this heartbeat
(claude-mitm deliberately does not poll `/usage` — see
[cloudflare-blocks-sidecar-polling](cloudflare-blocks-sidecar-polling.md)),
so the quota gauges in ai-cloud-v2 simply stopped receiving readings.
Diagnosed 2026-08-18 against the development cluster: `orgQuotaGauges` held
exactly one sample time, 54 h old, while the counter families ingested by
the same operator and the same `recordBatch` were current.

Guard with `chrome.alarms.get()` and only create when nothing is scheduled.
The alarm itself survives worker restarts, so there is nothing to re-arm.

The guard falls through to `create()` if `alarms.get()` itself throws: its
promise form needs Chrome 111+, and swallowing that error would leave **no**
alarm at all, which is strictly worse than the reset bug. Degrading to the old
behaviour is the safe direction.

---
title: A sentinel sample makes a broken parser debuggable
used_by:
  - packages/gpt-tracker/lib/usage-signal.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Signal-seen debug marker <a id="signal-seen-debug-marker"></a>

### packages/gpt-tracker/lib/usage-signal.ts

`chatgpt.usage.signal_seen` is always emitted, independent of whether
anything else in `samplesFromUsagePayload` actually parses — this is
what makes a wrong field-shape guess debuggable instead of invisible.
Without it, a broken parser and "user hasn't hit any limits yet" look
identical from Convex: both show message counts with no
`chatgpt.usage.*` samples. With it, `signal_seen` incrementing while
`*_remaining` stays absent is a visible, checkable discrepancy.

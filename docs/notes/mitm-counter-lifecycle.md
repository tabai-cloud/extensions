---
title: In-memory counters are enough for a long-lived sidecar process
used_by:
  - packages/claude-mitm/addon.py
sidebar:
  badge: { text: extensions, variant: note }
---

## mitm counter lifecycle <a id="mitm-counter-lifecycle"></a>

### packages/claude-mitm/addon.py

Module-scope cumulative counters, mirroring
`@ai-cloud-tracker/shared`'s `incrementMessageCount` — this process
lives for the pod's whole lifetime (no MV3-style suspend/resume to worry
about), so a plain in-memory dict is enough; nothing here needs to
survive a restart any more than the extension's own
`chrome.storage.local` counters did.

---
title: The manifest description is deliberately shallow
used_by:
  - packages/claude-tracker/wxt.config.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Deliberately shallow manifest description <a id="why-shallow-description"></a>

### packages/claude-tracker/wxt.config.ts

Deliberately shallow — this description is what the end user of the
deployed workload sees in `chrome://extensions`, and the actual behavior
(usage-limit reporting to this workload's own operator) is not meant to
be user-facing.

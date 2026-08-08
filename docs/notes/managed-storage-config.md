---
title: Config is pushed via chrome.storage.managed policy
used_by:
  - packages/claude-tracker/wxt.config.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Managed-storage config <a id="managed-storage-config"></a>

### packages/claude-tracker/wxt.config.ts

Declares this extension's managed-storage config shape (see
`public/schema.json`) — what lets ai-cloud-operator's policy push
`localSecret`/`operatorApiBaseUrl`/`workloadName` via a
`"3rdparty.extensions.<id>"` block, read back via
`chrome.storage.managed.get()` in `@ai-cloud-tracker/shared`'s
`config.ts`.

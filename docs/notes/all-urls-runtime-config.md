---
title: "<all_urls> instead of a fixed host list"
used_by:
  - packages/claude-tracker/wxt.config.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## `<all_urls>` for runtime config <a id="all-urls-runtime-config"></a>

### packages/claude-tracker/wxt.config.ts

`<all_urls>` rather than a specific host list: claude.ai is fixed, but
the operator's own API base URL is runtime config (pushed via
`chrome.storage.managed` at pod-start by ai-cloud-operator's own policy,
see `@ai-cloud-tracker/shared`'s `config.ts`), not a manifest-time
constant — baking a specific origin in here would go stale the moment
that address changes shape (a different Service name, a different
cluster). Force-installed via policy, never distributed through a Web
Store, so there's no store review or interactive consent prompt a broad
grant here would complicate.

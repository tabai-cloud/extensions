---
title: Force-installed via policy, never installed interactively
used_by:
  - packages/claude-tracker/wxt.config.ts
  - packages/gpt-tracker/wxt.config.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Force-install via policy <a id="force-install-via-policy"></a>

### packages/claude-tracker/wxt.config.ts

No popup/options page, no action icon — this extension is
force-installed via ai-cloud-operator's `ExtensionSettings` policy (see
`internal/catalog/tracker.go`), never installed interactively. Besides
the periodic usage-limit heartbeat, it also injects a "Solicitar acesso"
button into claude.ai's own chat sidebar/list — see
`entrypoints/request-ownership.content.ts`, a file-based WXT content
script (matches declared there, not here) that needs no additional
`host_permissions` beyond the `<all_urls>` already granted (the button's
own backend call goes through the background worker, which already has
that grant).

### packages/gpt-tracker/wxt.config.ts

No popup/options page, no action icon — force-installed via
ai-cloud-operator's `ExtensionSettings` policy (see
`internal/catalog/tracker.go`), never installed interactively, nothing
for a user to look at.

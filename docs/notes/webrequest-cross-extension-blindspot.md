---
title: "chrome.webRequest cannot see another extension's own traffic"
used_by:
  - packages/claude-tracker/entrypoints/background.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## chrome.webRequest cross-extension blind spot <a id="webrequest-cross-extension-blindspot"></a>

### packages/claude-tracker/entrypoints/background.ts

This extension's own message-send detection used to run on
`chrome.webRequest`, matching claude.ai's completion endpoints. That was
removed in favor of `packages/claude-mitm` — a mitmproxy sidecar addon that
also covers Anthropic's official "Claude for Chrome" sidebar extension,
which `chrome.webRequest` cannot observe cross-extension no matter what URL
pattern is registered: Chrome's webRequest API does not let one extension
observe network requests initiated from another extension's own privileged
context (background service worker, side panel, popup) — only requests
happening in a real tab/page are visible cross-extension. The sidebar sends
messages via `api.anthropic.com/v1/messages` entirely from its own side
panel's JS context, so claude-tracker could never see it. This was
confirmed empirically with a diagnostic webRequest listener that saw zero
requests to `api.anthropic.com` while a `chrome://net-export` capture of
the same session clearly showed the sidebar's traffic happening. See
`packages/claude-mitm`'s own README for the full investigation.

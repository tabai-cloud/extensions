---
title: chrome.webRequest never exposes response bodies
used_by:
  - packages/gpt-tracker/entrypoints/gpt-signal.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## webRequest never sees response bodies <a id="webrequest-no-response-bodies"></a>

### packages/gpt-tracker/entrypoints/gpt-signal.content.ts

This runs as a MAIN-world script — it wraps the exact same
`window.fetch` the ChatGPT frontend itself calls — which is what lets it
read full response BODIES. `chrome.webRequest` only ever exposes
headers/status, never body content, in both MV2 and MV3. MAIN-world
scripts have no `chrome.*` APIs at all, so the only way out is
`window.postMessage` to the ISOLATED-world relay content script (see
`gpt-relay.content.ts`) sharing this same page's `window`. Ported from
this repo's original `contents/chatgpt-usage.ts`, minus its popup-facing
extras.

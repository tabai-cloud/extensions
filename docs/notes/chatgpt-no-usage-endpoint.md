---
title: chatgpt.com has no direct GET /usage endpoint
used_by:
  - packages/gpt-tracker/entrypoints/background.ts
  - packages/gpt-tracker/wxt.config.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## ChatGPT has no usage endpoint <a id="chatgpt-no-usage-endpoint"></a>

### packages/gpt-tracker/entrypoints/background.ts

`LAST_USAGE_KEY` caches the most recently observed usage-signal
payload — unlike claude-tracker, there's no direct GET `/usage` endpoint
to (re-)fetch on a heartbeat tick with no fresh page activity, since
chatgpt.com's usage signals only ever arrive as a side effect of the
content script observing real traffic. Re-reporting the last known
values on each heartbeat still gets the same self-healing "try again
next tick" resilience for whatever was already observed, even though it
can't proactively refresh it.

### packages/gpt-tracker/wxt.config.ts

Unlike claude-tracker, this package DOES need content scripts
(`entrypoints/gpt-signal.content.ts`, `entrypoints/gpt-relay.content.ts`):
chatgpt.com has no direct GET `/usage` endpoint the way claude.ai does,
so usage signals can only be observed by sniffing chatgpt.com's own
`/backend-api/*` response bodies as they fly by — the same technique
this repo's original `contents/chatgpt-usage.ts` used, ported here
without its popup UI.

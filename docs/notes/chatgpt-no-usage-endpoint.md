---
title: chatgpt.com has no direct GET /usage endpoint
used_by:
  - packages/gpt-tracker/entrypoints/background.ts
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

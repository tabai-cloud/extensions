---
title: The message-send URL marker deliberately excludes GET history loads
used_by:
  - packages/gpt-tracker/entrypoints/gpt-signal.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Message-send URL marker precision <a id="message-send-url-marker-precision"></a>

### packages/gpt-tracker/entrypoints/gpt-signal.content.ts

`MESSAGE_SEND_URL_MARKER` is the endpoint that fires once per message
actually sent, confirmed live against real traffic by the original
ai-cloud-tracker POC (see that repo's `contents/chatgpt-usage.ts`).
Deliberately NOT matching a broader `"/backend-api/conversation"`
prefix — that also matches GET requests just loading an existing
conversation's history, which must not count as a send.

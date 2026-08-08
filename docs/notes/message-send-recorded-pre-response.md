---
title: A message send is counted on request, not on response
used_by:
  - packages/gpt-tracker/entrypoints/gpt-signal.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Message send recorded pre-response <a id="message-send-recorded-pre-response"></a>

### packages/gpt-tracker/entrypoints/gpt-signal.content.ts

Recorded before awaiting the response — a message "send" is the request
going out, not a successful reply; counting it after the `await` would
undercount every stream that gets aborted, which is the common case
here.

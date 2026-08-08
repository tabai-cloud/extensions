---
title: Reading SSE streams incrementally survives mid-flight aborts
used_by:
  - packages/gpt-tracker/entrypoints/gpt-signal.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## SSE stream abort handling <a id="sse-stream-abort-handling"></a>

### packages/gpt-tracker/entrypoints/gpt-signal.content.ts — readEventStream

Reading a streaming (SSE) response via `response.clone().text()` waits
for the WHOLE body, so a stream that gets aborted mid-flight (very
common here — ChatGPT's own frontend cancels the previous stream
whenever a new message starts) loses everything. Reading incrementally
via `getReader()` processes each chunk as it arrives, so whatever
streamed before the abort is still seen.

### packages/gpt-tracker/entrypoints/gpt-signal.content.ts — catch(err)

Expected/harmless: the page's own code aborts the previous stream
whenever a new message starts. Whatever chunks arrived before the abort
were still processed above, so an `AbortError` here is not logged as an
error — anything else is.

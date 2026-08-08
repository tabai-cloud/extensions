---
title: gpt-relay and gpt-signal content scripts must start together
used_by:
  - packages/gpt-tracker/entrypoints/gpt-relay.content.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## GPT content-script timing race <a id="gpt-content-script-timing-race"></a>

### packages/gpt-tracker/entrypoints/gpt-relay.content.ts

Must match `gpt-signal.content.ts`'s `document_start`: that MAIN-world
script starts posting messages the instant its fetch hook installs, and
this listener has to already be registered by then — at the default
`document_idle`, every signal fired before idle is dropped silently (no
queue, no error) since `window.postMessage` has no listener yet.

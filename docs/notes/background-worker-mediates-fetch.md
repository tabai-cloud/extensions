---
title: The background worker mediates every operator fetch
used_by:
  - packages/claude-tracker/entrypoints/background.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Background worker mediates fetch <a id="background-worker-mediates-fetch"></a>

### packages/claude-tracker/entrypoints/background.ts

Both the "Solicitar acesso" button's own backend call and the "already
have access" badge's ownership lookup (see
`entrypoints/request-ownership.content.ts`) run in the background worker
rather than as a direct `fetch()` from the content script itself — same
reasoning as `fetchUsage` in `lib/claude-api.ts`: these operator calls
need this extension's own `host_permissions` grant, not whatever
CORS/CSP policy claude.ai's own page happens to set for scripts running
in its DOM. `sendResponse` is called asynchronously, so this listener
must return `true` to keep the message channel open for it — the
standard `chrome.runtime.onMessage` contract.

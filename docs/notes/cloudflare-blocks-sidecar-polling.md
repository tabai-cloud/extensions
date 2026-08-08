---
title: "Cloudflare blocks the sidecar's own active usage polling"
used_by:
  - packages/claude-tracker/entrypoints/background.ts
  - packages/claude-tracker/lib/claude-api.ts
  - packages/claude-mitm/addon.py
sidebar:
  badge: { text: extensions, variant: note }
---

## Cloudflare blocks sidecar polling <a id="cloudflare-blocks-sidecar-polling"></a>

### packages/claude-tracker/entrypoints/background.ts

The periodic usage-limit heartbeat stays in this extension rather than
moving to `packages/claude-mitm` alongside message-send detection.
claude-mitm's own attempt at an equivalent active heartbeat — polling
`/usage` directly from its own sidecar process — was tried and reverted:
claude.ai sits behind Cloudflare bot detection, and a script-originated
request from outside the browser (different network origin, different TLS
fingerprint) got blocked (HTTP 403) even when replaying a captured session
cookie and a real User-Agent. `fetch()` from inside a real browser tab
doesn't have that problem at all — it IS the real browser request, by
construction. Since claude-mitm is only ever deployed alongside this
extension (never instead of it — see ai-cloud-operator's
`internal/catalog/tracker.go`), keeping the heartbeat here leaves no
coverage gap.

### packages/claude-tracker/lib/claude-api.ts

`fetchUsage` calls claude.ai's own usage endpoint directly, with no
`Authorization` header of its own — this extension's `host_permissions`
cover claude.ai (see `wxt.config.ts`), which makes a background-context
`fetch` attach the browser's existing session cookies automatically,
bypassing normal cross-origin CORS restrictions. Confirmed against
lugia19/Claude-Usage-Extension's own `ContainerStrategy.fetch` default
(Chrome/Electron) path: a plain `fetch(url, options)`, no manual cookie
handling at all. This is exactly the browser-native request claude-mitm's
own active-heartbeat attempt (tried and reverted, see that package's own
`addon.py` doc comment) couldn't replicate from outside the browser:
right network origin, right TLS fingerprint, every header exactly what
Cloudflare's bot detection expects, for free.

### packages/claude-mitm/addon.py

Usage-limit percentages are reported passively here — off whatever
`/usage` responses the browser happens to make on its own (`response()`,
cheap and immediate when it happens) — but NOT actively polled from this
process. That was tried (an earlier version of this file ran its own
background heartbeat thread hitting `/usage` directly via `urllib`) and
reverted: claude.ai sits behind Cloudflare bot detection, and a
script-originated request from this sidecar's own process — not a real
browser tab, different network origin, different TLS fingerprint — got
flagged even after replaying a captured session cookie AND a real
User-Agent/Referer (confirmed live, 2026-08-04: HTTP 403). A genuine
`fetch()` from inside the browser itself sails through for free, with
the right origin/fingerprint/headers by construction, and doesn't have
to fight an arms race we don't control either side of. So the
guaranteed-cadence usage heartbeat lives back in claude-tracker's own
`chrome.alarms` — see that package's `background.ts` — since it's a
general, account-level, non-sidebar-specific metric, there's no coverage
gap left by keeping it there: claude-tracker's extension is
force-installed unconditionally whenever claude-mitm is (see
`tracker.go`), so it's always present to do this half of the job.

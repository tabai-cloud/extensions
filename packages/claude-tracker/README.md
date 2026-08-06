# claude-tracker

A UI-less browser extension that reports Claude usage-limit percentages
(session/weekly, per-model) to this workload's own operator — no popup, no
options page, no `chrome.storage` UI of any kind.

See the repo root README for the shared reporting architecture (this
package and its `gpt-tracker` sibling both use `@ai-cloud-tracker/shared`
for config bootstrap + operator reporting), and `packages/claude-mitm`'s
own README for where message-send detection (per-model counts) actually
lives now — not here.

## How it works

- `entrypoints/background.ts` is the whole extension: a background service
  worker, no content scripts, no `chrome.webRequest` listener. It used to
  also detect message sends (matching claude.ai's completion endpoints);
  that moved to `packages/claude-mitm`, a mitmproxy sidecar that can see
  Anthropic's official "Claude for Chrome" sidebar extension's traffic too
  — something `chrome.webRequest` structurally cannot, since one extension
  can't observe network requests initiated from another extension's own
  privileged context (confirmed empirically — see `claude-mitm`'s README
  for the full investigation).
- What's left here is purely the usage-limit heartbeat: `chrome.alarms`
  fires every 15 minutes, `lib/claude-api.ts#fetchUsage` calls
  `GET https://claude.ai/api/organizations/{orgId}/usage` (a plain,
  credentialed `fetch()`, browser session cookies attached automatically —
  no manual cookie handling). Response shape parsing
  (`lib/claude-api.ts#parseUsage`) is ported from
  [lugia19/Claude-Usage-Extension](https://github.com/lugia19/Claude-Usage-Extension)'s
  `shared/dataclasses.js`.
- `chrome.cookies.get({name: 'lastActiveOrg', ...})` is the org-ID-discovery
  fallback for the heartbeat.
- **Why the heartbeat stays here instead of also moving to `claude-mitm`**:
  tried and reverted. `claude-mitm` briefly had its own active heartbeat
  (polling `/usage` directly from the sidecar's own process), but claude.ai
  sits behind Cloudflare bot detection, and a script-originated request —
  different network origin, different TLS fingerprint than a real browser
  tab — got blocked (HTTP 403) even replaying a captured session cookie and
  a real User-Agent. A genuine `fetch()` from inside this extension's own
  background worker doesn't have that problem: it IS the real browser
  request. Since `claude-mitm` is only ever deployed alongside this
  extension, never instead of it (see `ai-cloud-operator`'s
  `internal/catalog/tracker.go`), keeping the heartbeat here leaves no
  coverage gap.

## Install (manual/dev)

```
pnpm install   # from the repo root
pnpm --filter claude-tracker build   # -> packages/claude-tracker/.output/chrome-mv3
```

Load `.output/chrome-mv3` as an unpacked extension via `chrome://extensions`
(Developer mode) — **must be Chromium, not branded Google Chrome**.

## Install (unattended, e.g. a container init step)

```
TRACKER_PACKAGE=claude-tracker \
  wget -qO- https://raw.githubusercontent.com/tabai-cloud/extensions/main/scripts/install.sh | sh
```

See the repo root's `scripts/install.sh`. `extension/` is a committed,
prebuilt snapshot — rebuild locally (`pnpm --filter claude-tracker build`)
and re-copy `.output/chrome-mv3/*` into `extension/` after changing
anything under `entrypoints/`/`lib/` or the shared package.

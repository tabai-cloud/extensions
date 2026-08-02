# claude-tracker

A UI-less browser extension that watches claude.ai's own network traffic and
API responses to report message counts (per model) and usage limits (per
preset) to this workload's own operator — no popup, no options page, no
`chrome.storage` UI of any kind.

See the repo root README for the shared reporting architecture (this
package and its `gpt-tracker` sibling both use
`@ai-cloud-tracker/shared` for config bootstrap + operator reporting).

## How it works

- `entrypoints/background.ts` is the whole extension: a background service
  worker, no content scripts at all — unlike `gpt-tracker`, claude.ai
  exposes a direct `GET /usage` endpoint, so there's no need to sniff
  response bodies from a content script.
- `chrome.webRequest.onBeforeRequest` (non-blocking, `requestBody` only —
  no `webRequestBlocking` permission) matches Claude's own message-send
  endpoints (`.../chat_conversations/*/completion` and
  `.../retry_completion`). This is the "a message was sent" + "which model"
  signal, extracted straight from the org ID in the URL and the `model`
  field in the request body.
- Right after each detected send, `lib/claude-api.ts#fetchUsage` calls
  `GET https://claude.ai/api/organizations/{orgId}/usage` directly — a
  plain, credentialed `fetch()`, no manual cookie handling required.
  Response shape parsing (`lib/claude-api.ts#parseUsage`) is ported from
  [lugia19/Claude-Usage-Extension](https://github.com/lugia19/Claude-Usage-Extension)'s
  `shared/dataclasses.js`.
- `chrome.alarms` runs a periodic heartbeat (every 15 minutes) so usage
  still gets reported during idle browsing.
- `chrome.cookies.get({name: 'lastActiveOrg', ...})` is the org-ID-discovery
  fallback for the heartbeat path.

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
  wget -qO- https://raw.githubusercontent.com/gojnimer-labs/ai-cloud-tracker/main/scripts/install.sh | sh
```

See the repo root's `scripts/install.sh`. `extension/` is a committed,
prebuilt snapshot — rebuild locally (`pnpm --filter claude-tracker build`)
and re-copy `.output/chrome-mv3/*` into `extension/` after changing
anything under `entrypoints/`/`lib/` or the shared package.

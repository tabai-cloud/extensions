# gpt-tracker

A UI-less browser extension that watches chatgpt.com's own network traffic
to report message counts (per model) and best-effort usage-limit signals to
this workload's own operator — no popup, no options page.

See the repo root README for the shared reporting architecture (this
package and its `claude-tracker` sibling both use
`@ai-cloud-tracker/shared` for config bootstrap + operator reporting).

## Why this package looks different from claude-tracker

claude.ai exposes a direct `GET /api/organizations/{orgId}/usage` endpoint,
so `claude-tracker` is pure background-service-worker — no content
scripts needed at all. chatgpt.com has no equivalent endpoint (confirmed by
the original [tabai-cloud/extensions](https://github.com/tabai-cloud/extensions)
POC, which only ever found usage fields by watching real response bodies),
so this package needs the same content-script technique that POC used:

- `entrypoints/gpt-signal.content.ts` (MAIN world) wraps `window.fetch` to
  read full response **bodies** (`chrome.webRequest` only ever exposes
  headers/status, never body content) and to record each message-send
  (`POST /backend-api/f/conversation`). Ported from that POC's
  `contents/chatgpt-usage.ts`, minus its popup-facing extras.
- `entrypoints/gpt-relay.content.ts` (ISOLATED world) bridges
  `window.postMessage` from the MAIN-world script into
  `chrome.runtime.sendMessage`, into the background service worker — unlike
  the original POC's `relay.ts` (which wrote straight to
  `chrome.storage.local` to dodge a cold service worker), this routes
  through the background on purpose: the background is what holds the
  operator's local secret and makes the authenticated report call, and
  `chrome.runtime.sendMessage` reliably wakes a dormant MV3 service worker
  to receive it — but that call can still reject if the worker is torn down
  mid-flight (a race, not the common case), and a rejected `message-sent`
  is a permanently lost message count: there's no queue or retry on this
  path, unlike claude-tracker's `webRequest` listener, which runs in the
  background directly and has no such relay hop to lose a message on.
- `entrypoints/background.ts` receives relayed messages, increments
  per-model counters and reports usage samples via
  `@ai-cloud-tracker/shared`, and re-reports the last-known usage payload
  on a 15-minute heartbeat (there's no endpoint to proactively re-fetch
  fresh usage from, unlike claude-tracker).

## A known gap: usage-signal shape is best-effort, not verified

`lib/usage-signal.ts#samplesFromUsagePayload` is a best-effort guess at
`limits_progress`/`model_limits`'s field shapes. The original POC only ever
logged these fields to the console for discovery — it never shipped a real
parser — so unlike `claude-tracker`'s usage parsing (ported from a mature,
maintained reference extension with confirmed field shapes), **this should
be re-verified against a live chatgpt.com session** before trusting the
exact metric values it reports. A wrong guess degrades gracefully (fewer
samples reported, never a crash), but it may need adjusting once watched
against real traffic.

## Install (manual/dev)

```
pnpm install   # from the repo root
pnpm --filter gpt-tracker build   # -> packages/gpt-tracker/.output/chrome-mv3
```

Load `.output/chrome-mv3` as an unpacked extension via `chrome://extensions`
(Developer mode) — **must be Chromium, not branded Google Chrome**.

## Install (unattended, e.g. a container init step)

```
TRACKER_PACKAGE=gpt-tracker \
  wget -qO- https://raw.githubusercontent.com/tabai-cloud/extensions/main/scripts/install.sh | sh
```

See the repo root's `scripts/install.sh`. `extension/` is a committed,
prebuilt snapshot — rebuild locally (`pnpm --filter gpt-tracker build`) and
re-copy `.output/chrome-mv3/*` into `extension/` after changing anything
under `entrypoints/`/`lib/` or the shared package.

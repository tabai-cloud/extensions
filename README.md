# ai-cloud-tracker

A pnpm monorepo of usage-telemetry code — mostly UI-less browser
extensions, plus one mitmproxy sidecar addon — that watches an AI chat
site's own traffic and reports usage telemetry (message counts per model,
usage-limit signals) to that workload's own [ai-cloud-operator](https://github.com/gojnimer-labs/ai-cloud-operator)
— never Convex directly, never a popup, never an options page.

## Packages

- [`packages/claude-tracker`](./packages/claude-tracker) — a claude.ai-watching
  background service worker. Its own message-send detection (`chrome.
  webRequest`) is gone, moved to `claude-mitm` (see that package's README
  for why — short version: it can observe claude.ai's webapp traffic fine,
  but not Anthropic's official "Claude for Chrome" sidebar extension, which
  `chrome.webRequest` structurally cannot see across extensions). Its
  usage-limit heartbeat stayed here, though, and is now this package's only
  job — a genuine `fetch()` from inside a real browser tab sails through
  claude.ai's Cloudflare bot detection for free; a script-originated
  request from `claude-mitm`'s own sidecar process didn't (tried, reverted
  — see that package's README).
- [`packages/claude-mitm`](./packages/claude-mitm) — a mitmproxy addon run
  as a sidecar in the same pod: the single source of truth for per-model
  message counts (both claude.ai's webapp and Claude for Chrome's sidebar),
  plus a passive (not active) bonus observer of usage-limit responses the
  browser happens to make on its own.
- [`packages/gpt-tracker`](./packages/gpt-tracker) — watches chatgpt.com.
  Needs content scripts (MAIN-world `fetch` wrapping + an ISOLATED-world
  relay) since chatgpt.com has no equivalent direct usage endpoint — see
  that package's own README for why it looks structurally different from
  `claude-tracker`, and for a known gap in how well-verified its
  usage-signal parsing is. Not yet covered by a `-mitm` equivalent.
- [`packages/shared`](./packages/shared) — `@ai-cloud-tracker/shared`:
  config bootstrap and reporting (`POST /workloads/{name}/extension/report`),
  shared verbatim between the browser-extension packages (`claude-mitm` is
  plain Python, so it reimplements the same tiny reporting contract itself
  rather than importing this).

## How a workload gets one of these

ai-cloud-operator's `chromium-tracker` catalog template has an
`extensionId` select parameter (`none` / `claude-tracker` / `gpt-tracker`).
Picking one:

1. Mints a per-workload local secret (`internal/extensiontoken`), never
   shared with Convex.
2. Force-loads the selected package's extension via `CHROME_CLI
   --load-extension`, fetched at pod-start by an init container running
   this repo's own `scripts/install.sh` (parameterized by `TRACKER_PACKAGE`
   — see that script).
3. Writes `config.json` (the local secret, the operator's own reachable API
   base URL, and the workload's own name) into the extension's install
   directory, which the extension's background worker reads at startup via
   `@ai-cloud-tracker/shared`'s `loadConfig`.

The extension then reports directly to the operator's own
`POST /workloads/{name}/extension/report`, which the operator relays into
Convex on its own existing heartbeat-token channel — see
ai-cloud-operator's `internal/metrics.ExtensionCache` and
`internal/metrics.Reporter`.

## Development

```
pnpm install
pnpm --filter claude-tracker build   # -> packages/claude-tracker/.output/chrome-mv3
pnpm --filter gpt-tracker build      # -> packages/gpt-tracker/.output/chrome-mv3
```

Each package's `extension/` directory is a committed, prebuilt snapshot —
rebuild and re-copy `.output/chrome-mv3/*` into `extension/` after changing
`entrypoints/`/`lib/` in that package, or `packages/shared/src/`.

**Must load in real Chromium, not branded Google Chrome** — stable-channel
Google Chrome silently ignores `--load-extension`/unpacked loading outside
Chrome for Testing; Chromium (e.g. `lscr.io/linuxserver/chromium`, what
ai-cloud-operator's `chromium-tracker` template deploys) doesn't have that
restriction.

# ai-cloud-tracker

A pnpm monorepo of usage-telemetry browser extensions that watch an AI chat
site's own traffic and report usage telemetry (message counts per model,
usage-limit signals) to that workload's own [ai-cloud-operator](https://github.com/gojnimer-labs/ai-cloud-operator)
— never Convex directly, never a popup, never an options page.

## Packages

- [`packages/claude-tracker`](./packages/claude-tracker) — a claude.ai-watching
  background service worker. Its own message-send detection (`chrome.
  webRequest`) is gone, moved to [gojnimer-labs/ai-cloud-agent](https://github.com/gojnimer-labs/ai-cloud-agent)
  (a standalone repo, not a package here — see its own README for why:
  short version, `chrome.webRequest` can observe claude.ai's webapp traffic
  fine, but not Anthropic's official "Claude for Chrome" sidebar extension,
  which it structurally cannot see across extensions). Its usage-limit
  heartbeat stayed here, though, and is now this package's only job — a
  genuine `fetch()` from inside a real browser tab sails through claude.ai's
  Cloudflare bot detection for free; a script-originated request from
  ai-cloud-agent's own sidecar process didn't (tried, reverted — see that
  repo's README).
- [`packages/gpt-tracker`](./packages/gpt-tracker) — watches chatgpt.com.
  Needs content scripts (MAIN-world `fetch` wrapping + an ISOLATED-world
  relay) since chatgpt.com has no equivalent direct usage endpoint — see
  that package's own README for why it looks structurally different from
  `claude-tracker`, and for a known gap in how well-verified its
  usage-signal parsing is. Not yet covered by an ai-cloud-agent provider.
- [`packages/shared`](./packages/shared) — `@ai-cloud-tracker/shared`:
  config bootstrap and reporting (`POST /workloads/{name}/extension/report`),
  shared verbatim between the browser-extension packages in this repo.

`claude-mitm` — formerly a package here, the mitmproxy sidecar addon that
was the single source of truth for Claude per-model message counts (both
claude.ai's webapp and Claude for Chrome's sidebar) — moved out to its own
standalone repo, [gojnimer-labs/ai-cloud-agent](https://github.com/gojnimer-labs/ai-cloud-agent),
shipped as a real container image instead of a raw-GitHub-fetched Python
file. See that repo's README for the full design (it now also supports
per-user resource-ownership enforcement, and a provider architecture other
product integrations can plug into the same way).

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

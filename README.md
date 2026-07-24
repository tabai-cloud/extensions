# ai-cloud-tracker

A minimal browser extension that captures ChatGPT's own usage/quota signals
(the `limits_progress` / `model_limits` fields chatgpt.com's backend already
returns) and shows them in a toolbar popup — no scraping, no guessing, just
reading the numbers ChatGPT itself reports.

## How it works

- `contents/chatgpt-usage.ts` runs in the page's own JS context (`world:
  "MAIN"`) and wraps `window.fetch` so it can read full response **bodies**
  from `/backend-api/*` calls — `chrome.webRequest` only ever exposes
  headers/status, never body content, in Chrome or Firefox. Streaming
  (`text/event-stream`) responses are read incrementally via
  `response.body.getReader()` rather than waiting for the whole body, so a
  stream ChatGPT's own frontend aborts mid-flight (very common — a new
  message cancels the previous one) still yields whatever arrived before
  the abort.
- `contents/relay.ts` runs in the normal ISOLATED world on the same page,
  bridges `window.postMessage` from the MAIN-world script straight into
  `chrome.storage.local` — deliberately not routed through the background
  service worker, since that can be cold on a fresh page load and silently
  drops the message.
- `popup.tsx` reads `chrome.storage.local` and renders the current
  per-feature remaining counts, live-updating via `chrome.storage.onChanged`.

## Install (manual/dev)

```
pnpm install
pnpm build            # -> build/chrome-mv3-prod
```

Load `build/chrome-mv3-prod` as an unpacked extension via
`chrome://extensions` (Developer mode) — **must be Chromium, not branded
Google Chrome**. Stable-channel Google Chrome silently ignores
`--load-extension`/unpacked loading outside Chrome for Testing; Chromium
(the open-source build, e.g. `lscr.io/linuxserver/chromium`) doesn't have
that restriction. Confirmed the hard way: identical flags, identical
image family, only the browser binary differed.

Firefox was also evaluated: WebExtensions on regular release Firefox
enforce Mozilla signing even under `ExtensionSettings` enterprise policy —
`xpinstall.signatures.required` is explicitly on Mozilla's list of
policy-blocked preferences ("not allowed for stability reasons"), so an
unsigned local XPI can't be silently force-installed there. Not pursued
further for the automated/spin-up use case this repo exists for.

## Install (unattended, e.g. a container init step)

```
wget -qO- https://raw.githubusercontent.com/gojnimer-labs/ai-cloud-tracker/main/scripts/install.sh | sh
```

Downloads this repo's prebuilt `extension/` directory (no Node/git needed
at install time) into `/extensions/poc` by default. Override with
`TRACKER_INSTALL_DIR`/`TRACKER_BRANCH` env vars. Then point the browser at
it, e.g.:

```
CHROME_CLI=--load-extension=/extensions/poc --disable-extensions-except=/extensions/poc https://chatgpt.com
```

`extension/` is a committed, prebuilt snapshot (not rebuilt by CI on every
push yet) — rebuild locally (`pnpm build`) and re-copy to `extension/`
after changing `contents/`/`popup.tsx`.

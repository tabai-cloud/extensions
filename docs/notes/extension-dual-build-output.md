---
title: The extension/ directory serves both packaging and local dev
used_by:
  - scripts/pack-crx.mjs
sidebar:
  badge: { text: extensions, variant: note }
---

## Extension directory dual build output <a id="extension-dual-build-output"></a>

### scripts/pack-crx.mjs

Run from a package directory (e.g. `packages/claude-tracker`) after `wxt
build` — reads `./.output/chrome-mv3`, mirrors it into `./extension/`
(the prebuilt bundle ai-cloud-operator's `install.sh` downloads today,
kept for any `--load-extension`-based local dev/testing), then packs
that same content into `./extension.crx`.

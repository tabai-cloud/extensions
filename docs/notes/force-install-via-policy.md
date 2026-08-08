---
title: Force-installed via policy, never installed interactively
used_by:
  - packages/claude-tracker/wxt.config.ts
  - packages/gpt-tracker/wxt.config.ts
  - scripts/install.sh
sidebar:
  badge: { text: extensions, variant: note }
---

## Force-install via policy <a id="force-install-via-policy"></a>

### packages/claude-tracker/wxt.config.ts

No popup/options page, no action icon — this extension is
force-installed via ai-cloud-operator's `ExtensionSettings` policy (see
`internal/catalog/tracker.go`), never installed interactively. Besides
the periodic usage-limit heartbeat, it also injects a "Solicitar acesso"
button into claude.ai's own chat sidebar/list — see
`entrypoints/request-ownership.content.ts`, a file-based WXT content
script (matches declared there, not here) that needs no additional
`host_permissions` beyond the `<all_urls>` already granted (the button's
own backend call goes through the background worker, which already has
that grant).

### packages/gpt-tracker/wxt.config.ts

No popup/options page, no action icon — force-installed via
ai-cloud-operator's `ExtensionSettings` policy (see
`internal/catalog/tracker.go`), never installed interactively, nothing
for a user to look at.

### scripts/install.sh

Installs one package's prebuilt, unpacked `extension/` directory from
this monorepo — no git, no Node/pnpm needed at install time, only
wget/tar (both present in Alpine's busybox, the base
ai-cloud-operator's install-tracker-extension init container already
uses). `TRACKER_PACKAGE` selects which `packages/<name>` to install
(e.g. `"claude-tracker"`, `"gpt-tracker"`) — required, no default, since
installing "some extension or other" silently would be worse than
failing loudly. `TRACKER_INSTALL_DIR` (default `/extensions/poc`) and
`TRACKER_BRANCH` (default `main`) are the only other two things a caller
should ever need to override — `TRACKER_INSTALL_DIR` must match
ai-cloud-operator's own `trackerExtensionInstallDir` constant, passed
explicitly by that init container rather than relying on this default
silently matching.

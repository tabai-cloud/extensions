---
title: Config is pushed via chrome.storage.managed policy
used_by:
  - packages/claude-tracker/wxt.config.ts
  - packages/shared/src/config.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Managed-storage config <a id="managed-storage-config"></a>

### packages/claude-tracker/wxt.config.ts

Declares this extension's managed-storage config shape (see
`public/schema.json`) — what lets ai-cloud-operator's policy push
`localSecret`/`operatorApiBaseUrl`/`workloadName` via a
`"3rdparty.extensions.<id>"` block, read back via
`chrome.storage.managed.get()` in `@ai-cloud-tracker/shared`'s
`config.ts`.

### packages/shared/src/config.ts

`loadConfig` reads `chrome.storage.managed` — populated by Chromium
itself, before this extension's code ever runs, from the
`"3rdparty.extensions.<this extension's id>"` block in
ai-cloud-operator's own managed policy (see
`internal/catalog/tracker.go`'s `installTrackerExtensionInitContainer`).
This extension is force-installed via that same policy's
`ExtensionSettings` (never `--load-extension`, which a user could
remove/disable), so there's no writable, predictable install directory
left to drop a `config.json` into the way earlier versions of this
package did; `chrome.storage.managed` is the mechanism Chromium itself
provides for exactly this "push config into a policy-installed
extension" problem, keyed by each extension's own manifest-declared
`managed_schema.json` — every package in this monorepo carries an
identical `public/schema.json` (three string properties matching
`ExtensionConfig`) for this; kept per-package rather than one shared
file since WXT only copies a package's own `public/` dir into its build
output.

Returns `null` — never throws — if the fields aren't (yet, or ever) set:
e.g. this workload's template never had an extension enabled, the
operator hasn't finished writing policy yet, or this build was loaded
unpacked with no operator/policy around at all (manual/dev testing).
Every caller treats "not yet configured" as a normal, retry-later state.
Shared verbatim by every package in this monorepo — the config shape and
bootstrap mechanism is identical regardless of which site a given
extension watches.

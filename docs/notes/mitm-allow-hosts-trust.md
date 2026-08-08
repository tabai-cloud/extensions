---
title: --allow-hosts scoping is trusted to the launcher, not enforced here
used_by:
  - packages/claude-mitm/addon.py
sidebar:
  badge: { text: extensions, variant: note }
---

## mitm --allow-hosts trust boundary <a id="mitm-allow-hosts-trust"></a>

### packages/claude-mitm/addon.py

`--allow-hosts` (set by whoever launches `mitmdump` with this addon, see
ai-cloud-operator's `internal/catalog/tracker.go`) should be scoped to
`anthropic.com`/`claude.ai`/`claudeusercontent.com` specifically — this
addon does not enforce that itself, it trusts the launch configuration
to keep every other host in the browser passing through undecrypted.

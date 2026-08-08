---
title: "Product icon even with no popup/action to show it in"
used_by:
  - packages/claude-tracker/wxt.config.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Extension icon branding <a id="extension-icon-branding"></a>

### packages/claude-tracker/wxt.config.ts

TabAi Cloud's own product icon (sourced from ai-cloud-v2's
`public/tabai-icon-512.png`, resized to the standard extension sizes) —
this extension has no action/popup, so the only places this is ever seen
are `chrome://extensions` and the extensions-menu puzzle-piece dropdown,
but a generic default icon there would be an odd inconsistency next to
the "TabAi Cloud" name.

---
title: Never logs conversation content, despite having full plaintext access
used_by:
  - packages/claude-mitm/addon.py
sidebar:
  badge: { text: extensions, variant: note }
---

## mitm privacy posture <a id="mitm-privacy-posture"></a>

### packages/claude-mitm/addon.py

Deliberately extracts only the fields it needs (model, stop_reason,
usage percentages) and never logs, stores, or forwards conversation
content — system prompts, message text, tool inputs/outputs, or response
text. Despite having technical access to full plaintext (that's the
whole point of the proxy), this addon's privacy posture is meant to
match claude-tracker's own: counts and percentages only, never content.

---
title: URL suffixes are kept in sync by hand with claude-tracker
used_by:
  - packages/claude-mitm/addon.py
sidebar:
  badge: { text: extensions, variant: note }
---

## Claude message-send URL sync <a id="claude-message-send-url-sync"></a>

### packages/claude-mitm/addon.py

`WEBAPP_COMPLETION_SUFFIXES` is meant to match claude-tracker's own
message-send URL matching in `background.ts` — kept in sync by hand, not
shared code, since one's a TS webRequest filter and the other's a Python
path check. See `docs/notes/_UNCLEAR.md` for a doubt about whether this
cross-file reference is still accurate.

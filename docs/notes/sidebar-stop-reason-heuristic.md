---
title: Sidebar send completion is a heuristic, not a documented contract
used_by:
  - packages/claude-mitm/addon.py
sidebar:
  badge: { text: extensions, variant: note }
---

## Sidebar stop-reason heuristic <a id="sidebar-stop-reason-heuristic"></a>

### packages/claude-mitm/addon.py

`_terminal_stop_reason` scans a `/v1/messages` SSE response for how the
stream actually ended. Returns `"end_turn"` only for a real,
successfully-completed reply. Returns `None` for anything else — an
internal tool_use round-trip (e.g. the `turn_answer_start` step every
sidebar turn seems to start with), a server-side error event (e.g.
`overloaded_error`, which the client silently retries), or a response
that can't be parsed. This is a heuristic derived from one real captured
session (see this package's README), not something Anthropic documents
as a stable contract — expect to revisit if Claude for Chrome's internal
orchestration protocol changes shape.

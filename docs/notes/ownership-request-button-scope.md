---
title: What the "Solicitar acesso" button covers, and what it doesn't
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
  - packages/claude-tracker/lib/request-ownership-ui.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Ownership request button scope <a id="ownership-request-button-scope"></a>

### packages/claude-tracker/entrypoints/request-ownership.content.ts

This injects a "Solicitar acesso" button — or, for a chat the user already
has tracked access to, an "Acesso concedido" badge instead — into
claude.ai's own chat sidebar and `/chats` list. The button covers a chat
the sidecar's auto-claim-on-creation flow never covered: a pre-existing
chat from before ownership tracking existed, or one created via
Anthropic's own "Claude for Chrome" sidebar extension, which the sidecar
can't observe at all (see `convex/schema.ts`'s
`integrationOwnershipRequests` table doc comment in ai-cloud-v2 for the
full rationale). This is the retrocompatibility path, not the primary
flow: a brand-new chat created through this tracked session is
auto-claimed directly and never needs this button at all.

`SOURCE` is hardcoded `"claude"` here — this package only ever watches
claude.ai, unlike the generic `(source, type)` shape the operator route and
Convex table both carry all the way through.

### packages/claude-tracker/lib/request-ownership-ui.ts — RESOURCE_KINDS

The type is NOT hardcoded, because claude.ai lists two ownable things in the
same two surfaces: chats and **cowork sessions** — what Anthropic's own
"Claude for Chrome" side panel actually creates, every time (a side-panel chat
is always a cowork session, confirmed against a live capture). ai-cloud-agent
gates them as a separate `"cowork"` resource type, since their ids are
`cse_`-prefixed rather than UUIDs and claude.ai's own API rejects one on a
conversation-shaped route.

`RESOURCE_KINDS` is the single place that mapping lives: one entry per type,
each carrying the `data-row-key` prefix and the href pattern that identify it.
Both surface adapters and the content script derive everything from that list
(`OWNERSHIP_RESOURCE_TYPES`, `TARGET_ANCHOR_SELECTOR`), so adding a third
ownable type is one entry here rather than a new branch in each function.

Cowork sessions make the retrocompatibility path *more* load-bearing, not
less: ai-cloud-agent auto-claims a cowork session it observes being created,
but every session that already existed before that shipped is unowned and
unreadable until someone requests access — this button is the only way to ask.

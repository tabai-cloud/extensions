---
title: What the "Solicitar acesso" button covers, and what it doesn't
used_by:
  - packages/claude-tracker/entrypoints/request-ownership.content.ts
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

`SOURCE`/`RESOURCE_TYPE` are hardcoded `"claude"`/`"chat"` here — this
package only ever watches claude.ai, unlike the generic `(source, type)`
shape the operator route and Convex table both carry all the way through.

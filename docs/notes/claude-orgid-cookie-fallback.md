---
title: "orgId discovery falls back to the lastActiveOrg cookie"
used_by:
  - packages/claude-tracker/entrypoints/background.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Claude orgId cookie fallback <a id="claude-orgid-cookie-fallback"></a>

### packages/claude-tracker/entrypoints/background.ts

`discoverOrgId` falls back to the `lastActiveOrg` cookie whenever this
service-worker lifetime hasn't already cached one — the same fallback
lugia19/Claude-Usage-Extension's `container-strategy.js` uses.
`storeId: '0'` (the default cookie store) is also explicit for the same
reason, matching that same reference extension's own
`container-strategy.js`, even though this container only ever runs one
plain Chromium profile with no multi-account containers — so omitting it
would likely resolve the same store anyway, but there's no reason to
leave it implicit.

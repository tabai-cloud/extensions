---
title: The CRX signing key is committed to pin the extension ID, not to gate distribution
used_by:
  - scripts/pack-crx.mjs
sidebar:
  badge: { text: extensions, variant: note }
---

## CRX signing key stability <a id="crx-signing-key-stability"></a>

### scripts/pack-crx.mjs

The signing key (`./signing-key.pem`) is generated once and reused on
every subsequent run — the extension's ID is derived entirely from this
key (see `crxIdFromPublicKey`), so reusing it is what keeps the ID
stable across releases. Committed to the repo deliberately: it only pins
an ID, it doesn't gate distribution (ai-cloud-operator always fetches
`extension.crx` from this repo directly, never validates anyone else's
signature against it).

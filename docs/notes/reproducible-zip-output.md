---
title: The minimal ZIP writer trades deflate for reproducible bytes
used_by:
  - scripts/pack-crx.mjs
sidebar:
  badge: { text: extensions, variant: note }
---

## Reproducible ZIP output <a id="reproducible-zip-output"></a>

### scripts/pack-crx.mjs

Minimal ZIP writer — stored (uncompressed) entries only, which is all
CRX3 needs (Chromium decompresses nothing extra beyond the zip format
itself, and these bundles are a few KB, so there's no benefit to
implementing deflate here). Fixed 1980-01-01 mod time/date on every
entry for reproducible output (byte-identical zip given identical
input), not because the value has any meaning to Chromium.

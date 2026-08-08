---
title: The config cache only ever holds a successful read
used_by:
  - packages/shared/src/config.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Config cache holds success only <a id="config-cache-positive-only"></a>

### packages/shared/src/config.ts

Cached in module scope — avoids a storage round trip on every single
call within one service-worker lifetime. Deliberately only ever holds a
SUCCESSFUL read, never a cached "not configured yet" — a transient read
failure must not permanently wedge every later call in this same
service-worker instance into skipping config forever; each call with no
cached value simply retries.

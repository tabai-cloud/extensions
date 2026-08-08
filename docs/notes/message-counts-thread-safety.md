---
title: Read-then-write message counting is safe on a single JS thread
used_by:
  - packages/shared/src/messageCounts.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Message counts thread safety <a id="message-counts-thread-safety"></a>

### packages/shared/src/messageCounts.ts

`incrementMessageCount` bumps this workload's own running total for
`modelSlug` and returns the new cumulative value, ready to report as-is
(see ai-cloud-operator's `workloadMetrics`: a running cumulative counter,
never a delta). Read-then-write, not an atomic increment —
`chrome.storage.local` has no such primitive — but this is safe here:
`onBeforeRequest`/content-script callbacks for a single extension
instance all run on one JS thread, so there's no real concurrent-write
race to guard against. Model-vocabulary-agnostic (`modelSlug` is just
whatever string the caller passes), so shared verbatim across every
package — only each package's own `lib/models.ts` knows what its site's
model names actually look like.

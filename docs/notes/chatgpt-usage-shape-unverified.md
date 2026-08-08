---
title: ChatGPT usage payload shape is a best-effort guess, not verified
used_by:
  - packages/gpt-tracker/lib/usage-signal.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## ChatGPT usage shape unverified <a id="chatgpt-usage-shape-unverified"></a>

### packages/gpt-tracker/lib/usage-signal.ts — UsagePayload

`UsagePayload` is what `gpt-signal.content.ts` relays: the raw
`limits_progress`/`model_limits` fields chatgpt.com's own
`/backend-api/*` responses carry, per this repo's original
`contents/chatgpt-usage.ts` (its own comment: "limits_progress (the
primary chat/message cap — empty until you're close to/over it) and
model_limits (per-feature remaining count + reset_after timestamp, e.g.
image_gen, deep_research)").

### packages/gpt-tracker/lib/usage-signal.ts — samplesFromUsagePayload

Deliberately best-effort and NOT verified against real chatgpt.com
traffic the way claude-tracker's usage parsing is (that one ports a
mature, maintained reference extension's own tested field shapes). The
original ai-cloud-tracker POC only ever logged these two fields to the
console for discovery — it never shipped a real parser — so the exact
shape of `limitsProgress`/`modelLimits` entries here is a reasonable
guess, not a confirmed contract. Anything that doesn't match the shape
this function expects is silently skipped rather than thrown, so a wrong
guess degrades to "fewer usage samples reported" rather than a crash —
but this should be re-verified against a live chatgpt.com session before
relying on the exact metric values.

`model_limits` is normally empty and only populated once a user is close
to/over their message cap (per the original POC's own finding) — with no
confirmed field shape for what it looks like when populated, this only
reports whether it's non-empty at all, not any specific value inside it.

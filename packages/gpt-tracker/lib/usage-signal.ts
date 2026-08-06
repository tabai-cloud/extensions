import type { MetricSample } from "@ai-cloud-tracker/shared"

// UsagePayload is what gpt-signal.content.ts relays: the raw
// limits_progress/model_limits fields chatgpt.com's own /backend-api/*
// responses carry, per tabai-cloud/extensions's original
// contents/chatgpt-usage.ts (its own comment: "limits_progress (the
// primary chat/message cap — empty until you're close to/over it) and
// model_limits (per-feature remaining count + reset_after timestamp, e.g.
// image_gen, deep_research)").
export interface UsagePayload {
  limitsProgress: unknown
  modelLimits: unknown
  updatedAt: number
}

interface LimitsProgressEntry {
  feature?: string
  remaining?: number
}

// samplesFromUsagePayload is deliberately best-effort and NOT verified
// against real chatgpt.com traffic the way claude-tracker's usage parsing
// is (that one ports a mature, maintained reference extension's own tested
// field shapes). The original ai-cloud-tracker POC only ever logged these
// two fields to the console for discovery — it never shipped a real
// parser — so the exact shape of limitsProgress/modelLimits entries here is
// a reasonable guess, not a confirmed contract. Anything that doesn't match
// the shape this function expects is silently skipped rather than thrown,
// so a wrong guess degrades to "fewer usage samples reported" rather than
// a crash — but this should be re-verified against a live chatgpt.com
// session before relying on the exact metric values.
export function samplesFromUsagePayload(payload: UsagePayload, now: number): MetricSample[] {
  const samples: MetricSample[] = []

  // Always emitted, independent of whether anything below actually parses —
  // this is what makes a wrong field-shape guess debuggable instead of
  // invisible. Without it, a broken parser and "user hasn't hit any limits
  // yet" look identical from Convex: both show message counts with no
  // chatgpt.usage.* samples. With it, signal_seen incrementing while
  // *_remaining stays absent is a visible, checkable discrepancy.
  samples.push({ metric: "chatgpt.usage.signal_seen", value: 1, sampledAt: now })

  const entries = Array.isArray(payload.limitsProgress) ? (payload.limitsProgress as LimitsProgressEntry[]) : []
  for (const entry of entries) {
    if (typeof entry.feature === "string" && typeof entry.remaining === "number") {
      samples.push({
        metric: `chatgpt.usage.${entry.feature}_remaining`,
        value: entry.remaining,
        sampledAt: now
      })
    }
  }

  // model_limits is normally empty and only populated once a user is close
  // to/over their message cap (per the original POC's own finding) — with
  // no confirmed field shape for what it looks like when populated, this
  // only reports whether it's non-empty at all, not any specific value
  // inside it.
  const modelLimits = Array.isArray(payload.modelLimits) ? payload.modelLimits : []
  samples.push({
    metric: "chatgpt.usage.near_limit",
    value: modelLimits.length > 0 ? 1 : 0,
    sampledAt: now
  })

  return samples
}

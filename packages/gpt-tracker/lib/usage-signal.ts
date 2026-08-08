import type { MetricSample } from "@ai-cloud-tracker/shared"

// WHY: docs/notes/chatgpt-usage-shape-unverified.md#chatgpt-usage-shape-unverified — raw limits_progress/model_limits fields relayed from gpt-signal.content.ts, per this repo's original contents/chatgpt-usage.ts.
export interface UsagePayload {
  limitsProgress: unknown
  modelLimits: unknown
  updatedAt: number
}

interface LimitsProgressEntry {
  feature?: string
  remaining?: number
}

// WHY: docs/notes/chatgpt-usage-shape-unverified.md#chatgpt-usage-shape-unverified — best-effort and NOT verified against real chatgpt.com traffic; an unexpected shape is silently skipped, degrading to fewer samples rather than a crash.
export function samplesFromUsagePayload(payload: UsagePayload, now: number): MetricSample[] {
  const samples: MetricSample[] = []

  // WHY: docs/notes/signal-seen-debug-marker.md#signal-seen-debug-marker — always emitted regardless of parse success, so a broken field-shape guess is a visible discrepancy instead of indistinguishable from "no limits hit yet".
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

  // WHY: docs/notes/chatgpt-usage-shape-unverified.md#chatgpt-usage-shape-unverified — model_limits' populated shape is unconfirmed, so only presence/absence is reported, never a value from inside it.
  const modelLimits = Array.isArray(payload.modelLimits) ? payload.modelLimits : []
  samples.push({
    metric: "chatgpt.usage.near_limit",
    value: modelLimits.length > 0 ? 1 : 0,
    sampledAt: now
  })

  return samples
}

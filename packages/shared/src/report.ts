import { loadConfig } from "./config"

export interface MetricSample {
  metric: string
  value: number
  sampledAt: number
}

// WHY: docs/notes/operator-local-api-auth.md#operator-local-api-auth — POSTs to this workload's own operator-local endpoint, never Convex directly, authenticated by a per-workload local secret.
// WHY: docs/notes/best-effort-report-no-retry.md#best-effort-report-no-retry — a failed report is logged, not thrown; the next scheduled report carries current cumulative values, so there's no retry/backoff to duplicate.
export async function reportSamples(samples: MetricSample[]): Promise<void> {
  if (samples.length === 0) return

  const config = await loadConfig()
  if (!config) return

  try {
    const response = await fetch(
      `${config.operatorApiBaseUrl}/workloads/${config.workloadName}/extension/report`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.localSecret}`
        },
        body: JSON.stringify({ samples })
      }
    )
    if (!response.ok) {
      console.error("[ai-cloud-tracker] report failed", response.status)
    }
  } catch (err) {
    console.error("[ai-cloud-tracker] report error", err)
  }
}

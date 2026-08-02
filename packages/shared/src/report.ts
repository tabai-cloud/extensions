import { loadConfig } from "./config"

export interface MetricSample {
  metric: string
  value: number
  sampledAt: number
}

// reportSamples POSTs samples to this workload's own operator-local
// POST /workloads/{name}/extension/report endpoint (see ai-cloud-operator's
// internal/api.Server#handleExtensionReport) — never Convex directly, and
// authenticated by a per-workload local secret only this operator and this
// workload's own extension ever hold, not a Convex-facing credential.
//
// Best-effort: a failed report is logged, not thrown. The caller's own
// chrome.storage.local counters are unaffected either way, and the next
// scheduled report (the next message-send, or the periodic alarm heartbeat
// each package's own entrypoints/background.ts runs) carries the current,
// still-correct cumulative values — the same self-healing "try again next
// tick" resilience the operator's own metrics reporting already relies on
// (see ai-cloud-operator's internal/metrics.ExtensionCache), so there's no
// retry/backoff logic to duplicate here. Shared verbatim by every package
// in this monorepo — reporting is entirely site-agnostic.
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

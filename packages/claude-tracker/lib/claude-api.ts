export interface UsageLimits {
  session: number | null
  weekly: number | null
  weeklySonnet: number | null
  weeklyOpus: number | null
  weeklyFable: number | null
}

interface RawLimitEntry {
  kind?: string
  percent?: number
  scope?: { model?: { display_name?: string } }
}

interface RawUsageResponse {
  limits?: RawLimitEntry[]
  five_hour?: { utilization?: number }
  seven_day?: { utilization?: number }
  seven_day_sonnet?: { utilization?: number }
  seven_day_opus?: { utilization?: number }
}

const SCOPED_MODEL_KEY: Record<string, keyof UsageLimits> = {
  sonnet: "weeklySonnet",
  opus: "weeklyOpus",
  fable: "weeklyFable"
}

// WHY: docs/notes/claude-usage-response-shapes.md#claude-usage-response-shapes — ports lugia19/Claude-Usage-Extension's parser; supports both the newer `limits` array shape and the older top-level fields since claude.ai has shipped both with no version header to branch on.
export function parseUsage(raw: RawUsageResponse): UsageLimits {
  if (Array.isArray(raw.limits) && raw.limits.length > 0) {
    const limits: UsageLimits = {
      session: null,
      weekly: null,
      weeklySonnet: null,
      weeklyOpus: null,
      weeklyFable: null
    }
    for (const entry of raw.limits) {
      if (typeof entry.percent !== "number") continue
      if (entry.kind === "session") {
        limits.session = entry.percent
      } else if (entry.kind === "weekly_all") {
        limits.weekly = entry.percent
      } else if (entry.kind === "weekly_scoped") {
        const model = entry.scope?.model?.display_name?.toLowerCase()
        const key = model ? SCOPED_MODEL_KEY[model] : undefined
        if (key) limits[key] = entry.percent
      }
    }
    return limits
  }

  return {
    session: raw.five_hour?.utilization ?? null,
    weekly: raw.seven_day?.utilization ?? null,
    weeklySonnet: raw.seven_day_sonnet?.utilization ?? null,
    weeklyOpus: raw.seven_day_opus?.utilization ?? null,
    weeklyFable: null
  }
}

// WHY: docs/notes/cloudflare-blocks-sidecar-polling.md#cloudflare-blocks-sidecar-polling — a background-context fetch attaches the browser's real session/TLS fingerprint for free, which claude-mitm's own out-of-browser polling attempt couldn't replicate.
export async function fetchUsage(orgId: string): Promise<UsageLimits | null> {
  try {
    const response = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`, {
      headers: { "Content-Type": "application/json" }
    })
    if (!response.ok) return null
    return parseUsage((await response.json()) as RawUsageResponse)
  } catch (err) {
    console.error("[claude-tracker] fetchUsage error", err)
    return null
  }
}

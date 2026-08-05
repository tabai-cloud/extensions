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

// parseUsage ports lugia19/Claude-Usage-Extension's shared/dataclasses.js —
// UsageData.fromAPIResponse/parseNewLimits: prefers the newer, authoritative
// `limits` array (`{kind, percent, scope}`) when present, falling back to
// the older top-level five_hour/seven_day/seven_day_sonnet/seven_day_opus
// fields otherwise. Claude's own API has shipped both response shapes at
// different times with no version header to branch on ahead of time, so
// both are handled rather than assuming only the current one will ever show
// up. weeklyFable has no old-format fallback — the old shape predates
// Fable's own scoped weekly limit existing at all.
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

// fetchUsage calls claude.ai's own usage endpoint directly, with no
// Authorization header of our own — this extension's host_permissions
// cover claude.ai (see wxt.config.ts), which makes a background-context
// fetch attach the browser's existing session cookies automatically,
// bypassing normal cross-origin CORS restrictions. Confirmed against
// lugia19/Claude-Usage-Extension's own ContainerStrategy.fetch default
// (Chrome/Electron) path: a plain `fetch(url, options)`, no manual cookie
// handling at all. This is exactly the browser-native request
// gojnimer-labs/ai-cloud-agent's own active-heartbeat attempt (tried and
// reverted, see that repo's providers/claude.py doc comment) couldn't
// replicate from outside the browser: right network origin, right TLS
// fingerprint, every header exactly what Cloudflare's bot detection
// expects, for free.
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

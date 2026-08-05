import { loadConfig, reportSamples } from "@ai-cloud-tracker/shared"
import { fetchUsage } from "../lib/claude-api"

// This extension's own message-send detection (chrome.webRequest, matching
// claude.ai's completion endpoints) was removed in favor of
// gojnimer-labs/ai-cloud-agent — a standalone mitmproxy sidecar repo that
// also covers Anthropic's official "Claude for Chrome" sidebar extension,
// which chrome.webRequest cannot observe cross-extension no matter what URL
// pattern is registered (see that repo's own README for the full
// investigation).
//
// This usage-limit heartbeat stays here, though — ai-cloud-agent's own
// attempt at an equivalent active heartbeat (polling /usage directly from
// its own sidecar process) was tried and reverted: claude.ai sits behind
// Cloudflare bot detection, and a script-originated request from outside
// the browser — different network origin, different TLS fingerprint — got
// blocked (HTTP 403) even replaying a captured session cookie and a real
// User-Agent. fetch() from inside a real browser tab doesn't have that
// problem at all; it IS the real browser request, by construction. Since
// ai-cloud-agent's sidecar is only ever deployed alongside this extension
// (never instead of it — see ai-cloud-operator's
// internal/catalog/tracker.go), keeping the heartbeat here leaves no
// coverage gap.
const HEARTBEAT_ALARM_NAME = "claude-tracker-heartbeat"
const HEARTBEAT_PERIOD_MINUTES = 15

// lastKnownOrgId is a module-scope cache only — chrome.storage.local isn't
// needed here since a fresh orgId is always recoverable from the
// lastActiveOrg cookie (see discoverOrgId), so losing this on a
// service-worker restart costs at most one skipped heartbeat tick, not a
// real gap.
let lastKnownOrgId: string | null = null

async function reportUsage(orgId: string): Promise<void> {
  const limits = await fetchUsage(orgId)
  if (!limits) return

  const now = Date.now()
  const candidates: Array<{ metric: string; value: number | null }> = [
    { metric: "claude.usage.session", value: limits.session },
    { metric: "claude.usage.weekly", value: limits.weekly },
    { metric: "claude.usage.weekly_sonnet", value: limits.weeklySonnet },
    { metric: "claude.usage.weekly_opus", value: limits.weeklyOpus },
    { metric: "claude.usage.weekly_fable", value: limits.weeklyFable }
  ]
  const samples = candidates
    .filter((c): c is { metric: string; value: number } => typeof c.value === "number")
    .map((c) => ({ metric: c.metric, value: c.value, sampledAt: now }))

  await reportSamples(samples)
}

// discoverOrgId falls back to the lastActiveOrg cookie whenever this
// service-worker lifetime hasn't already cached one — same fallback
// lugia19/Claude-Usage-Extension's container-strategy.js uses.
async function discoverOrgId(): Promise<string | null> {
  if (lastKnownOrgId) return lastKnownOrgId
  try {
    // storeId: '0' is the default cookie store, matching
    // lugia19/Claude-Usage-Extension's own container-strategy.js — this
    // container only ever runs one plain Chromium profile with no
    // multi-account containers, so omitting it would likely resolve the
    // same store anyway, but there's no reason to leave it implicit.
    const cookie = await chrome.cookies.get({
      name: "lastActiveOrg",
      url: "https://claude.ai",
      storeId: "0"
    })
    if (cookie?.value) {
      lastKnownOrgId = cookie.value
      return cookie.value
    }
  } catch (err) {
    console.error("[claude-tracker] cookie lookup failed", err)
  }
  return null
}

export default defineBackground(() => {
  // Periodic heartbeat is the ONLY thing this background entrypoint does
  // now — no webRequest listener at all (see this file's own top-of-file
  // comment for why). chrome.alarms is the MV3-correct way to get a
  // guaranteed wake-up point — setInterval doesn't survive worker
  // suspension.
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== HEARTBEAT_ALARM_NAME) return
    discoverOrgId()
      .then((orgId) => (orgId ? reportUsage(orgId) : undefined))
      .catch((err) => console.error("[claude-tracker] heartbeat error", err))
  })
  // create() is idempotent for an existing alarm of the same name (just
  // resets its schedule), so calling this on every wake is safe.
  chrome.alarms.create(HEARTBEAT_ALARM_NAME, { periodInMinutes: HEARTBEAT_PERIOD_MINUTES })

  // Warm the config cache as soon as the worker starts, rather than waiting
  // for the first alarm tick to discover whether this workload was
  // actually enrolled.
  loadConfig().catch((err) => console.error("[claude-tracker] loadConfig error", err))
})

import { listOwnership, loadConfig, reportSamples, requestOwnership } from "@ai-cloud-tracker/shared"
import { fetchUsage } from "../lib/claude-api"
import type { ListOwnershipMessage, RequestOwnershipMessage } from "../lib/request-ownership-message"

// WHY: docs/notes/webrequest-cross-extension-blindspot.md#webrequest-cross-extension-blindspot — message-send detection moved to packages/claude-mitm because chrome.webRequest can't see the "Claude for Chrome" sidebar's own cross-extension traffic.
// WHY: docs/notes/cloudflare-blocks-sidecar-polling.md#cloudflare-blocks-sidecar-polling — the usage-limit heartbeat stays here because claude-mitm's own active-polling attempt got Cloudflare-blocked (403) from outside the browser.
const HEARTBEAT_ALARM_NAME = "claude-tracker-heartbeat"
const HEARTBEAT_PERIOD_MINUTES = 15

// WHY: docs/notes/mv3-worker-lifecycle.md#mv3-worker-lifecycle — module-scope cache only; a fresh orgId is always recoverable from the lastActiveOrg cookie, so a worker restart costs at most one heartbeat tick.
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

// WHY: docs/notes/claude-orgid-cookie-fallback.md#claude-orgid-cookie-fallback — falls back to the lastActiveOrg cookie when no orgId is cached yet, same fallback lugia19/Claude-Usage-Extension uses.
async function discoverOrgId(): Promise<string | null> {
  if (lastKnownOrgId) return lastKnownOrgId
  try {
    // WHY: docs/notes/claude-orgid-cookie-fallback.md#claude-orgid-cookie-fallback — storeId '0' matches lugia19/Claude-Usage-Extension explicitly, even though this single-profile container would likely resolve the same store either way.
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
  // WHY: docs/notes/mv3-worker-lifecycle.md#mv3-worker-lifecycle — chrome.alarms is the only correct way to get a guaranteed wake-up in MV3; setInterval doesn't survive worker suspension.
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== HEARTBEAT_ALARM_NAME) return
    discoverOrgId()
      .then((orgId) => (orgId ? reportUsage(orgId) : undefined))
      .catch((err) => console.error("[claude-tracker] heartbeat error", err))
  })
  // create() is idempotent for an existing alarm of the same name (just
  // resets its schedule), so calling this on every wake is safe.
  chrome.alarms.create(HEARTBEAT_ALARM_NAME, { periodInMinutes: HEARTBEAT_PERIOD_MINUTES })

  // WHY: docs/notes/mv3-worker-lifecycle.md#mv3-worker-lifecycle — config cache is warmed at worker startup rather than waiting for the first alarm tick.
  loadConfig().catch((err) => console.error("[claude-tracker] loadConfig error", err))

  // WHY: docs/notes/background-worker-mediates-fetch.md#background-worker-mediates-fetch — both operator calls run here (not in the content script) for this extension's own host_permissions/CORS grant; sendResponse is async so the listener must return true.
  chrome.runtime.onMessage.addListener(
    (message: ListOwnershipMessage | RequestOwnershipMessage, _sender, sendResponse) => {
      if (message.type === "requestOwnership") {
        requestOwnership(message.source, message.resourceType, message.resourceId)
          .then((ok) => sendResponse({ ok }))
          .catch((err) => {
            console.error("[claude-tracker] requestOwnership message error", err)
            sendResponse({ ok: false })
          })
        return true
      }
      if (message.type === "listOwnership") {
        listOwnership(message.source, message.resourceType)
          .then((resourceIds) => sendResponse({ resourceIds }))
          .catch((err) => {
            console.error("[claude-tracker] listOwnership message error", err)
            sendResponse({ resourceIds: null })
          })
        return true
      }
      return undefined
    }
  )
})

import { loadConfig, reportSamples, incrementMessageCount } from "@ai-cloud-tracker/shared"
import { modelSlugFromVersion } from "../lib/models"
import { fetchUsage } from "../lib/claude-api"

// Matches Claude's own message-send endpoints — a POST here is what fires
// exactly once per message actually sent, model and all, mirroring
// lugia19/Claude-Usage-Extension's background.js#onBeforeRequestHandler.
// Deliberately just these two path suffixes, not a broader
// "/organizations/*/chat_conversations/*" prefix — that would also match
// plain GETs loading an existing conversation's history, which must not
// count as a send.
const MESSAGE_SEND_URL_PATTERNS = [
  "https://claude.ai/api/organizations/*/chat_conversations/*/completion",
  "https://claude.ai/api/organizations/*/chat_conversations/*/retry_completion"
]

const HEARTBEAT_ALARM_NAME = "claude-tracker-heartbeat"
const HEARTBEAT_PERIOD_MINUTES = 15

// lastKnownOrgId is a module-scope cache only — chrome.storage.local isn't
// needed here since a fresh orgId is always recoverable, either from the
// very next completion request's own URL or from the lastActiveOrg cookie
// (see discoverOrgId), so losing this on a service-worker restart costs at
// most one skipped heartbeat tick, not a real gap.
let lastKnownOrgId: string | null = null

function orgIdFromURL(url: string): string | null {
  const match = /\/organizations\/([^/]+)\//.exec(url)
  return match?.[1] ?? null
}

// decodeRequestBody reassembles chrome.webRequest's raw request-body chunks
// (details.requestBody.raw, an array of {bytes: ArrayBuffer}) back into the
// JSON object Claude's own frontend actually sent — webRequest never hands
// back a parsed body, only these raw byte chunks.
function decodeRequestBody(
  details: chrome.webRequest.WebRequestBodyDetails
): Record<string, unknown> | null {
  const raw = details.requestBody?.raw
  if (!raw || raw.length === 0) return null
  try {
    const decoder = new TextDecoder()
    const text = raw
      .map((part) => (part.bytes ? decoder.decode(part.bytes) : ""))
      .join("")
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

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

async function handleMessageSent(details: chrome.webRequest.WebRequestBodyDetails): Promise<void> {
  // The url filter above can't express HTTP method at all (RequestFilter has
  // no such field), so it also matches a GET to the same path if Claude's
  // API ever serves one there — checking method here too matches
  // lugia19/Claude-Usage-Extension's own onBeforeRequestHandler, which
  // guards on `details.method === "POST"` for exactly this reason.
  if (details.method !== "POST") return

  const orgId = orgIdFromURL(details.url)
  if (orgId) lastKnownOrgId = orgId

  const body = decodeRequestBody(details)
  const modelSlug = modelSlugFromVersion(typeof body?.model === "string" ? body.model : undefined)

  const count = await incrementMessageCount(modelSlug)
  await reportSamples([
    { metric: `claude.messages.${modelSlug}`, value: count, sampledAt: Date.now() }
  ])

  if (orgId) await reportUsage(orgId)
}

// discoverOrgId falls back to the lastActiveOrg cookie when no completion
// request has been observed yet this service-worker lifetime (e.g. right
// after a pod restart, before the user has sent a first message) — same
// fallback lugia19/Claude-Usage-Extension's container-strategy.js uses.
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
  // Registered synchronously at the top level of the background entrypoint
  // (not inside a callback/promise) so it correctly re-arms every time the
  // MV3 service worker wakes from being suspended — a listener added
  // asynchronously can miss requests that arrive before it finishes
  // registering. No "webRequestBlocking" permission needed: this only
  // observes requests, never modifies or cancels one.
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      handleMessageSent(details).catch((err) =>
        console.error("[claude-tracker] handleMessageSent error", err)
      )
    },
    { urls: MESSAGE_SEND_URL_PATTERNS },
    ["requestBody"]
  )

  // Periodic heartbeat so usage still gets reported during idle browsing,
  // not just right after a message send, and so a long-suspended service
  // worker has a guaranteed wake-up point (chrome.alarms is the MV3-correct
  // way to do this — setInterval doesn't survive worker suspension).
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
  // for the first message-send or alarm tick to discover whether this
  // workload was actually enrolled.
  loadConfig().catch((err) => console.error("[claude-tracker] loadConfig error", err))
})

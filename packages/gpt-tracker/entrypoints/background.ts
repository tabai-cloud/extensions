import { loadConfig, reportSamples, incrementMessageCount } from "@ai-cloud-tracker/shared"
import { modelSlugFromVersion } from "../lib/models"
import { samplesFromUsagePayload, type UsagePayload } from "../lib/usage-signal"

const HEARTBEAT_ALARM_NAME = "gpt-tracker-heartbeat"
const HEARTBEAT_PERIOD_MINUTES = 15

// LAST_USAGE_KEY caches the most recently observed usage-signal payload —
// unlike claude-tracker, there's no direct GET /usage endpoint to
// (re-)fetch on a heartbeat tick with no fresh page activity, since
// chatgpt.com's usage signals only ever arrive as a side effect of the
// content script observing real traffic. Re-reporting the last known
// values on each heartbeat still gets the same self-healing "try again
// next tick" resilience for whatever was already observed, even though it
// can't proactively refresh it.
const LAST_USAGE_KEY = "lastUsagePayload"

interface ContentMessage {
  type: "usage-update" | "message-sent"
  payload: unknown
}

async function handleUsageUpdate(payload: UsagePayload): Promise<void> {
  await chrome.storage.local.set({ [LAST_USAGE_KEY]: payload })
  await reportSamples(samplesFromUsagePayload(payload, Date.now()))
}

async function handleMessageSent(payload: { model?: string }): Promise<void> {
  const modelSlug = modelSlugFromVersion(payload.model)
  const count = await incrementMessageCount(modelSlug)
  await reportSamples([
    { metric: `chatgpt.messages.${modelSlug}`, value: count, sampledAt: Date.now() }
  ])
}

async function reportCachedUsageIfAny(): Promise<void> {
  const stored = await chrome.storage.local.get(LAST_USAGE_KEY)
  const payload = stored[LAST_USAGE_KEY] as UsagePayload | undefined
  if (!payload) return
  await reportSamples(samplesFromUsagePayload(payload, Date.now()))
}

export default defineBackground(() => {
  // Registered synchronously at the top level, same reasoning as
  // claude-tracker's webRequest listener: re-arms correctly on every MV3
  // service-worker wake. chrome.runtime.sendMessage from
  // gpt-relay.content.ts is what actually wakes a dormant worker to
  // deliver this in the first place.
  chrome.runtime.onMessage.addListener((message: ContentMessage) => {
    if (message?.type === "message-sent") {
      handleMessageSent((message.payload as { model?: string }) ?? {}).catch((err) =>
        console.error("[gpt-tracker] handleMessageSent error", err)
      )
    } else if (message?.type === "usage-update") {
      handleUsageUpdate(message.payload as UsagePayload).catch((err) =>
        console.error("[gpt-tracker] handleUsageUpdate error", err)
      )
    }
    return false
  })

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== HEARTBEAT_ALARM_NAME) return
    reportCachedUsageIfAny().catch((err) => console.error("[gpt-tracker] heartbeat error", err))
  })
  chrome.alarms.create(HEARTBEAT_ALARM_NAME, { periodInMinutes: HEARTBEAT_PERIOD_MINUTES })

  loadConfig().catch((err) => console.error("[gpt-tracker] loadConfig error", err))
})

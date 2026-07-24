import type { PlasmoCSConfig } from "plasmo"

// MAIN world: runs in the page's own JS context, so it wraps the exact same
// window.fetch the ChatGPT frontend itself calls — this is what lets us read
// full response BODIES (chrome.webRequest only ever exposes headers/status,
// never body content, in both MV2 and MV3). MAIN-world scripts have no
// chrome.* APIs at all, so the only way out is window.postMessage to the
// ISOLATED-world relay content script (see contents/relay.ts) sharing this
// same page's `window`.
export const config: PlasmoCSConfig = {
  matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  world: "MAIN",
  run_at: "document_start"
}

const TAG = "[chatgpt-usage-poc]"
const RELAY_SOURCE = "chatgpt-usage-poc"
const originalFetch = window.fetch.bind(window)

// The two real usage-signal fields found live on chatgpt.com's own
// conversation-metadata response: model_limits (the primary chat/message
// cap — empty until you're close to/over it) and limits_progress (per-
// feature remaining count + reset_after timestamp, e.g. image_gen,
// deep_research).
const USAGE_SIGNAL_KEYS = ["limits_progress", "model_limits"]

function postUsageUpdate(parsed: any) {
  window.postMessage(
    {
      source: RELAY_SOURCE,
      type: "usage-update",
      payload: {
        limitsProgress: parsed.limits_progress ?? [],
        modelLimits: parsed.model_limits ?? [],
        updatedAt: Date.now()
      }
    },
    "*"
  )
}

// Pattern borrowed from lugia19/Claude-Usage-Extension's
// injections/rate-limit-watcher.js: reading a streaming (SSE) response via
// response.clone().text() waits for the WHOLE body, so a stream that gets
// aborted mid-flight (very common here — ChatGPT's own frontend cancels the
// previous stream whenever a new message starts) loses everything, which is
// exactly the "AbortError: The user aborted a request" gap seen on
// /backend-api/f/conversation. Reading incrementally via getReader()
// processes each chunk as it arrives, so whatever streamed before the abort
// is still seen — and, as a side effect, lets us discover what event
// "type"s ChatGPT's own stream actually uses (logged once per distinct
// type), since unlike Claude's documented "message_limit" SSE event, we
// don't yet know if/how ChatGPT signals a rate limit mid-stream.
const seenEventTypes = new Set<string>()

async function readEventStream(url: string, body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r\n|\r|\n/)
      // The last element may be a partial line split across chunk
      // boundaries — hold it back in the buffer until more data arrives.
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.startsWith("data:")) continue
        const data = line.slice(5).trim()
        if (!data || data === "[DONE]") continue

        try {
          const json = JSON.parse(data)
          if (json?.type && !seenEventTypes.has(json.type)) {
            seenEventTypes.add(json.type)
            console.log(`${TAG} [SSE event type seen]`, json.type)
          }
          if (USAGE_SIGNAL_KEYS.some((k) => k in json)) {
            console.log(`${TAG} [USAGE-SIGNAL] (stream) url:`, url, json)
            postUsageUpdate(json)
          }
        } catch {
          // Not JSON (e.g. a plain "data: [DONE]" or partial fragment) — ignore.
        }
      }
    }
  } catch (err: any) {
    // Expected/harmless: the page's own code aborts the previous stream
    // whenever a new message starts. Whatever chunks arrived before the
    // abort were still processed above.
    if (err?.name !== "AbortError") {
      console.error(TAG, "stream read error", url, err)
    }
  }
}

// Claude's rate-limit-watcher.js also treats a 429 with a nested
// JSON-stringified error.message as a rate-limit signal shape distinct from
// the streaming one. ChatGPT's own 429 shape hasn't been observed yet, but
// this is cheap defensive coverage for the day it shows up.
async function checkRateLimitStatus(url: string, response: Response) {
  if (response.status !== 429) return
  try {
    const body = await response.clone().text()
    console.log(`${TAG} [429]`, url, body.slice(0, 2000))
  } catch (err) {
    console.error(TAG, "failed reading 429 body", url, err)
  }
}

window.fetch = async (...args: Parameters<typeof fetch>) => {
  const response = await originalFetch(...args)

  try {
    const req = args[0]
    const url = typeof req === "string" ? req : req instanceof URL ? req.toString() : req.url

    if (url.includes("/backend-api/")) {
      checkRateLimitStatus(url, response)

      const contentType = response.headers.get("content-type") ?? ""
      if (contentType.includes("event-stream")) {
        if (response.body) readEventStream(url, response.clone().body!)
      } else {
        response
          .clone()
          .text()
          .then((body) => {
            const isUsageSignal = USAGE_SIGNAL_KEYS.some((k) => body.includes(`"${k}"`))
            if (!isUsageSignal) return

            console.log(`${TAG} [USAGE-SIGNAL] url:`, url)
            try {
              postUsageUpdate(JSON.parse(body))
            } catch (err) {
              console.error(TAG, "failed parsing usage-signal body", err)
            }
          })
          .catch((err) => console.error(TAG, "failed reading body", url, err))
      }
    }
  } catch (err) {
    console.error(TAG, "hook error", err)
  }

  return response
}

console.log(TAG, "fetch hook installed on", window.location.hostname)

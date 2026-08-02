// MAIN world: runs in the page's own JS context, so it wraps the exact same
// window.fetch the ChatGPT frontend itself calls — this is what lets us read
// full response BODIES (chrome.webRequest only ever exposes headers/status,
// never body content, in both MV2 and MV3). MAIN-world scripts have no
// chrome.* APIs at all, so the only way out is window.postMessage to the
// ISOLATED-world relay content script (see gpt-relay.content.ts) sharing
// this same page's `window`. Ported from gojnimer-labs/ai-cloud-tracker's
// original contents/chatgpt-usage.ts, minus its popup-facing extras.
export default defineContentScript({
  matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const TAG = "[gpt-tracker]"
    const RELAY_SOURCE = "gpt-tracker"
    const originalFetch = window.fetch.bind(window)

    // The two real usage-signal fields found live on chatgpt.com's own
    // conversation-metadata responses — see lib/usage-signal.ts's own doc
    // comment for how much of their shape is actually confirmed vs. a
    // best-effort guess.
    const USAGE_SIGNAL_KEYS = ["limits_progress", "model_limits"]

    function postUsageUpdate(parsed: Record<string, unknown>) {
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

    // MESSAGE_SEND_URL_MARKER is the endpoint that fires once per message
    // actually sent (confirmed live against real traffic by the original
    // ai-cloud-tracker POC — see that repo's contents/chatgpt-usage.ts).
    // Deliberately NOT matching a broader "/backend-api/conversation"
    // prefix — that also matches GET requests just loading an existing
    // conversation's history, which must not count as a send.
    const MESSAGE_SEND_URL_MARKER = "/backend-api/f/conversation"

    function postMessageSent(model: string | undefined) {
      window.postMessage(
        { source: RELAY_SOURCE, type: "message-sent", payload: { model, sentAt: Date.now() } },
        "*"
      )
    }

    // Reading a streaming (SSE) response via response.clone().text() waits
    // for the WHOLE body, so a stream that gets aborted mid-flight (very
    // common here — ChatGPT's own frontend cancels the previous stream
    // whenever a new message starts) loses everything. Reading
    // incrementally via getReader() processes each chunk as it arrives, so
    // whatever streamed before the abort is still seen.
    async function readEventStream(body: ReadableStream<Uint8Array>) {
      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r\n|\r|\n/)
          // The last element may be a partial line split across a chunk
          // boundary — hold it back until more data arrives.
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data:")) continue
            const data = line.slice(5).trim()
            if (!data || data === "[DONE]") continue

            try {
              const json = JSON.parse(data) as Record<string, unknown>
              if (USAGE_SIGNAL_KEYS.some((k) => k in json)) {
                postUsageUpdate(json)
              }
            } catch {
              // Not JSON (e.g. a plain "data: [DONE]" or partial fragment) — ignore.
            }
          }
        }
      } catch (err) {
        // Expected/harmless: the page's own code aborts the previous stream
        // whenever a new message starts. Whatever chunks arrived before the
        // abort were still processed above.
        if ((err as Error)?.name !== "AbortError") {
          console.error(TAG, "stream read error", err)
        }
      }
    }

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      try {
        const req = args[0]
        const url = typeof req === "string" ? req : req instanceof URL ? req.toString() : req.url
        const method = (args[1]?.method ?? (req instanceof Request ? req.method : "GET")).toUpperCase()

        // Recorded before awaiting the response — a message "send" is the
        // request going out, not a successful reply; counting it after the
        // await would undercount every stream that gets aborted (the
        // common case here).
        if (method === "POST" && url.includes(MESSAGE_SEND_URL_MARKER)) {
          let model: string | undefined
          const rawBody = args[1]?.body
          if (typeof rawBody === "string") {
            try {
              model = (JSON.parse(rawBody) as { model?: string }).model
            } catch {
              // Not JSON — model stays undefined, reported as "unknown".
            }
          }
          postMessageSent(model)
        }
      } catch (err) {
        console.error(TAG, "message-count hook error", err)
      }

      const response = await originalFetch(...args)

      try {
        const req = args[0]
        const url = typeof req === "string" ? req : req instanceof URL ? req.toString() : req.url

        if (url.includes("/backend-api/")) {
          const contentType = response.headers.get("content-type") ?? ""
          if (contentType.includes("event-stream")) {
            const clonedBody = response.clone().body
            if (clonedBody) void readEventStream(clonedBody)
          } else {
            response
              .clone()
              .text()
              .then((body) => {
                const isUsageSignal = USAGE_SIGNAL_KEYS.some((k) => body.includes(`"${k}"`))
                if (!isUsageSignal) return
                try {
                  postUsageUpdate(JSON.parse(body) as Record<string, unknown>)
                } catch (err) {
                  console.error(TAG, "failed parsing usage-signal body", err)
                }
              })
              .catch((err: unknown) => console.error(TAG, "failed reading body", err))
          }
        }
      } catch (err) {
        console.error(TAG, "hook error", err)
      }

      return response
    }

    console.log(TAG, "fetch hook installed on", window.location.hostname)
  }
})

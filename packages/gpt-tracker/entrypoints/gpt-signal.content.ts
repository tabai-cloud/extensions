// WHY: docs/notes/webrequest-no-response-bodies.md#webrequest-no-response-bodies — MAIN-world script wrapping window.fetch is the only way to read response bodies; chrome.webRequest never exposes them.
export default defineContentScript({
  matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const TAG = "[gpt-tracker]"
    const RELAY_SOURCE = "gpt-tracker"
    const originalFetch = window.fetch.bind(window)

    // The two real usage-signal fields on chatgpt.com's conversation-metadata
    // responses — see lib/usage-signal.ts for how confirmed their shape is.
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

    // WHY: docs/notes/message-send-url-marker-precision.md#message-send-url-marker-precision — a narrow marker so GET requests loading conversation history are never miscounted as a send.
    const MESSAGE_SEND_URL_MARKER = "/backend-api/f/conversation"

    function postMessageSent(model: string | undefined) {
      window.postMessage(
        { source: RELAY_SOURCE, type: "message-sent", payload: { model, sentAt: Date.now() } },
        "*"
      )
    }

    // WHY: docs/notes/sse-stream-abort-handling.md#sse-stream-abort-handling — reading incrementally via getReader() (not response.clone().text()) means a stream aborted mid-flight still yields whatever streamed before the abort.
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
        // WHY: docs/notes/sse-stream-abort-handling.md#sse-stream-abort-handling — the page's own code aborts the previous stream on a new message; chunks processed above are unaffected, so only a non-AbortError is logged.
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

        // WHY: docs/notes/message-send-recorded-pre-response.md#message-send-recorded-pre-response — counted before the await; counting after would undercount every aborted stream (the common case here).
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

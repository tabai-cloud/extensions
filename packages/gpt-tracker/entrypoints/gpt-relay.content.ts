// WHY: docs/notes/mv3-worker-lifecycle.md#mv3-worker-lifecycle — ISOLATED-world relay bridges window.postMessage -> chrome.runtime.sendMessage so the background worker (not the content script) makes the authenticated operator call.
export default defineContentScript({
  matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  // WHY: docs/notes/gpt-content-script-timing-race.md#gpt-content-script-timing-race — must match gpt-signal.content.ts's document_start or signals fired before document_idle are dropped silently.
  runAt: "document_start",
  main() {
    const RELAY_SOURCE = "gpt-tracker"

    window.addEventListener("message", (event) => {
      if (event.source !== window) return
      if (event.data?.source !== RELAY_SOURCE) return
      if (event.data.type !== "usage-update" && event.data.type !== "message-sent") return

      chrome.runtime.sendMessage({ type: event.data.type, payload: event.data.payload }).catch((err) => {
        console.error("[gpt-tracker] relay sendMessage failed", err)
      })
    })
  }
})

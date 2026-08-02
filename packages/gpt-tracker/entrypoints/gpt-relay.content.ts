// ISOLATED world (WXT's default — no `world` key) sharing chatgpt.com's page
// `window` with gpt-signal.content.ts's MAIN-world script, but unlike that
// one, THIS script keeps normal extension privileges. Its only job: bridge
// window.postMessage -> chrome.runtime.sendMessage, into the background
// service worker.
//
// Unlike gojnimer-labs/ai-cloud-tracker's original relay.ts (which wrote
// straight to chrome.storage.local specifically to dodge a cold MV3 service
// worker silently dropping a chrome.runtime.sendMessage), this DOES route
// through the background: chrome.runtime.sendMessage reliably wakes a
// dormant MV3 service worker to receive it, and the background needs to be
// the one making the authenticated report call to the operator anyway
// (content scripts have no business holding the operator's local secret or
// making that call themselves) — keeping every operator-facing HTTP call
// centralized in one place, the same as claude-tracker's design.
export default defineContentScript({
  matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
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

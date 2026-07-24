import type { PlasmoCSConfig } from "plasmo"

// ISOLATED world (Plasmo's default — no `world` key) sharing chatgpt.com's
// page `window` with contents/chatgpt-usage.ts's MAIN-world script, but
// unlike that one, THIS script keeps normal extension privileges. Its only
// job: bridge window.postMessage -> chrome.storage.local.
//
// Writes directly, NOT via chrome.runtime.sendMessage to the background —
// content scripts already have chrome.storage access on their own (only
// chrome.tabs/etc. actually require going through the background), and
// routing through sendMessage means it silently fails with "Could not
// establish connection" whenever the MV3 service worker is cold, which is
// often right after a fresh page load — exactly when contents/
// chatgpt-usage.ts's first capture (conversation/init) fires. Writing here
// directly has no such race.
export const config: PlasmoCSConfig = {
  matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"]
}

const RELAY_SOURCE = "chatgpt-usage-poc"

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  if (event.data?.source !== RELAY_SOURCE) return

  chrome.storage.local.set({ usage: event.data.payload })
})

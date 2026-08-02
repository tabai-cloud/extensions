import { defineConfig } from "wxt"

// No popup/options page, no action icon — force-loaded via CHROME_CLI (see
// ai-cloud-operator's internal/catalog/tracker.go), never installed
// interactively, nothing for a user to look at. Unlike claude-tracker,
// this package DOES need content scripts (entrypoints/gpt-signal.content.ts,
// entrypoints/gpt-relay.content.ts): chatgpt.com has no direct GET /usage
// endpoint the way claude.ai does, so usage signals can only be observed by
// sniffing chatgpt.com's own /backend-api/* response bodies as they fly by
// — the same technique gojnimer-labs/ai-cloud-tracker's original
// contents/chatgpt-usage.ts used, ported here without its popup UI.
export default defineConfig({
  manifest: {
    name: "ChatGPT Usage Tracker",
    description:
      "Reports ChatGPT message counts (per model) and best-effort usage-limit signals to this workload's own operator. No UI.",
    // No "webRequest": message-send detection happens by wrapping
    // window.fetch in a MAIN-world content script, not chrome.webRequest —
    // see gpt-signal.content.ts's own doc comment for why (chatgpt.com's
    // usage signals live in RESPONSE bodies, which webRequest can never
    // expose, only request metadata). No "cookies" either: unlike Claude's
    // background worker, nothing here needs an org-ID lookup.
    permissions: ["storage", "alarms"],
    // <all_urls> for the same reason as claude-tracker: the operator's own
    // API base URL is runtime config (config.json, written at pod-start),
    // not a manifest-time constant. This also covers chatgpt.com/
    // chat.openai.com for the content scripts' own network access needs.
    host_permissions: ["<all_urls>"],
    web_accessible_resources: [
      {
        resources: ["config.json"],
        matches: ["<all_urls>"]
      }
    ]
  }
})

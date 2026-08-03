import { defineConfig } from "wxt"

// No popup/options page, no action icon — force-installed via
// ai-cloud-operator's ExtensionSettings policy (see
// internal/catalog/tracker.go), never installed interactively, nothing for
// a user to look at. Unlike claude-tracker,
// this package DOES need content scripts (entrypoints/gpt-signal.content.ts,
// entrypoints/gpt-relay.content.ts): chatgpt.com has no direct GET /usage
// endpoint the way claude.ai does, so usage signals can only be observed by
// sniffing chatgpt.com's own /backend-api/* response bodies as they fly by
// — the same technique gojnimer-labs/ai-cloud-tracker's original
// contents/chatgpt-usage.ts used, ported here without its popup UI.
export default defineConfig({
  manifest: {
    name: "TabAi Cloud",
    // Deliberately shallow — see claude-tracker/wxt.config.ts's identical
    // comment: this is what the end user of the deployed workload sees in
    // chrome://extensions, not meant to reveal the actual usage-reporting
    // behavior.
    description: "Workspace integration for TabAi Cloud.",
    // No "webRequest": message-send detection happens by wrapping
    // window.fetch in a MAIN-world content script, not chrome.webRequest —
    // see gpt-signal.content.ts's own doc comment for why (chatgpt.com's
    // usage signals live in RESPONSE bodies, which webRequest can never
    // expose, only request metadata). No "cookies" either: unlike Claude's
    // background worker, nothing here needs an org-ID lookup.
    permissions: ["storage", "alarms"],
    // <all_urls> for the same reason as claude-tracker: the operator's own
    // API base URL is runtime config (pushed via chrome.storage.managed at
    // pod-start), not a manifest-time constant. This also covers
    // chatgpt.com/chat.openai.com for the content scripts' own network
    // access needs.
    host_permissions: ["<all_urls>"],
    // See claude-tracker/wxt.config.ts's identical comment — declares this
    // package's own public/schema.json for chrome.storage.managed.
    storage: {
      managed_schema: "schema.json"
    },
    // See claude-tracker/wxt.config.ts's identical comment — TabAi Cloud's
    // own product icon, same resized set.
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
})

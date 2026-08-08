import { defineConfig } from "wxt"

// WHY: docs/notes/force-install-via-policy.md#force-install-via-policy — no popup/options/action icon, force-installed via policy, nothing for a user to look at.
// WHY: docs/notes/chatgpt-no-usage-endpoint.md#chatgpt-no-usage-endpoint — unlike claude-tracker, needs content scripts because chatgpt.com has no direct GET /usage to poll.
export default defineConfig({
  manifest: {
    name: "TabAi Cloud",
    // Deliberately shallow — see claude-tracker/wxt.config.ts's identical
    // comment: not meant to reveal the actual usage-reporting behavior.
    description: "Workspace integration for TabAi Cloud.",
    // WHY: docs/notes/webrequest-no-response-bodies.md#webrequest-no-response-bodies — no "webRequest" permission; message-send detection wraps window.fetch instead, since webRequest never exposes response bodies. No "cookies": nothing here needs an org-ID lookup.
    permissions: ["storage", "alarms"],
    // WHY: docs/notes/all-urls-runtime-config.md#all-urls-runtime-config — same reason as claude-tracker (runtime-config operator URL), plus covers the content scripts' own network access to chatgpt.com/chat.openai.com.
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

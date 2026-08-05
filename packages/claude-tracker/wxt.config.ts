import { defineConfig } from "wxt"

// No popup/options page, no action icon — this extension is force-installed
// via ai-cloud-operator's ExtensionSettings policy (see
// internal/catalog/tracker.go), never installed interactively. Besides the
// periodic usage-limit heartbeat (see entrypoints/background.ts's own doc
// comment for why message-send detection moved to
// gojnimer-labs/ai-cloud-agent but this stayed), it also injects a
// "Solicitar acesso" button into claude.ai's own chat sidebar/list — see
// entrypoints/request-ownership.content.ts, a file-based WXT content
// script (matches declared there, not here) that needs no additional
// host_permissions beyond the <all_urls> already granted below (the
// button's own backend call goes through the background worker, which
// already has that grant).
export default defineConfig({
  manifest: {
    name: "TabAi Cloud",
    // Deliberately shallow — this description is what the end user of the
    // deployed workload sees in chrome://extensions, and the actual
    // behavior (usage-limit reporting to this workload's own operator) is
    // not meant to be user-facing.
    description: "Workspace integration for TabAi Cloud.",
    permissions: ["storage", "alarms", "cookies"],
    // <all_urls> rather than a specific host list: claude.ai is fixed, but
    // the operator's own API base URL is runtime config (pushed via
    // chrome.storage.managed at pod-start by ai-cloud-operator's own
    // policy, see @ai-cloud-tracker/shared's config.ts), not a
    // manifest-time constant — baking a specific origin in here would go
    // stale the moment that address changes shape (a different Service
    // name, a different cluster). Force-installed via policy, never
    // distributed through a Web Store, so there's no store review or
    // interactive consent prompt a broad grant here would complicate.
    host_permissions: ["<all_urls>"],
    // Declares this extension's managed-storage config shape (see
    // public/schema.json) — what lets ai-cloud-operator's policy push
    // localSecret/operatorApiBaseUrl/workloadName via a
    // "3rdparty.extensions.<id>" block, read back via
    // chrome.storage.managed.get() in @ai-cloud-tracker/shared's
    // config.ts.
    storage: {
      managed_schema: "schema.json"
    },
    // TabAi Cloud's own product icon (sourced from ai-cloud-v2's
    // public/tabai-icon-512.png, resized to the standard extension sizes)
    // — this extension has no action/popup, so the only places this is
    // ever seen are chrome://extensions and the extensions-menu
    // puzzle-piece dropdown, but a generic default icon there would be an
    // odd inconsistency next to the "TabAi Cloud" name.
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
})

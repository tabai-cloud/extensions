import { defineConfig } from "wxt"

// WHY: docs/notes/force-install-via-policy.md#force-install-via-policy — no popup/options/action icon, force-installed via ai-cloud-operator's ExtensionSettings policy, never installed interactively.
export default defineConfig({
  manifest: {
    name: "TabAi Cloud",
    // WHY: docs/notes/why-shallow-description.md#why-shallow-description — this is what the end user of the deployed workload sees in chrome://extensions; the real usage-reporting behavior isn't meant to be user-facing.
    description: "Workspace integration for TabAi Cloud.",
    permissions: ["storage", "alarms", "cookies"],
    // WHY: docs/notes/all-urls-runtime-config.md#all-urls-runtime-config — claude.ai is fixed, but the operator's own API base URL is runtime config pushed via chrome.storage.managed, not a manifest-time constant.
    host_permissions: ["<all_urls>"],
    // WHY: docs/notes/managed-storage-config.md#managed-storage-config — declares this extension's managed-storage config shape, what lets ai-cloud-operator's policy push localSecret/operatorApiBaseUrl/workloadName.
    storage: {
      managed_schema: "schema.json"
    },
    // WHY: docs/notes/extension-icon-branding.md#extension-icon-branding — TabAi Cloud's own product icon; a generic default would be an odd inconsistency next to the "TabAi Cloud" name even with no popup/action to show it in.
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
})

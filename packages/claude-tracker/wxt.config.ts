import { defineConfig } from "wxt"

// No content_scripts, no popup/options page, no action icon — this
// extension is force-loaded via CHROME_CLI (see ai-cloud-operator's
// internal/catalog/tracker.go), never installed interactively, and has
// nothing for a user to look at: it only watches claude.ai's own network
// requests from a background service worker and reports to this workload's
// own operator. See entrypoints/background.ts. Unlike its gpt-tracker
// sibling, claude.ai exposes a direct GET /usage endpoint, so no content
// script / response-body sniffing is needed here at all.
export default defineConfig({
  manifest: {
    name: "Claude Usage Tracker",
    description:
      "Reports Claude.ai message counts (per model) and usage limits (per preset) to this workload's own operator. No UI.",
    permissions: ["storage", "alarms", "webRequest", "cookies"],
    // <all_urls> rather than a specific host list: claude.ai is fixed, but
    // the operator's own API base URL is runtime config (written into
    // config.json at pod-start by ai-cloud-operator's install-tracker-
    // extension init container, see @ai-cloud-tracker/shared's config.ts),
    // not a manifest-time constant — baking a specific origin in here
    // would go stale the moment that address changes shape (a different
    // Service name, a different cluster). This extension is force-loaded
    // via --load-extension, never distributed through a Web Store, so
    // there's no store review or interactive consent prompt a broad grant
    // here would complicate.
    host_permissions: ["<all_urls>"],
    // config.json isn't a build-time asset — it's written directly into
    // this unpacked extension's own install directory by the operator's
    // init container, AFTER scripts/install.sh unpacks this package's
    // extension/ bundle (see the repo root's scripts/install.sh and
    // tracker.go's own doc comment on extensionConfigFileName). Declaring
    // it here is what lets chrome.runtime.getURL('config.json') + fetch()
    // read it despite it never having existed at pack time.
    web_accessible_resources: [
      {
        resources: ["config.json"],
        matches: ["<all_urls>"]
      }
    ]
  }
})

import { defineConfig } from "wxt"

// No content_scripts, no popup/options page, no action icon, no
// permissions — this extension is force-installed via ai-cloud-operator's
// ExtensionSettings policy (see internal/catalog/tracker.go), never
// installed interactively, and currently does nothing at all (see
// entrypoints/background.ts's own doc comment): its former usage-tracking
// role moved to packages/claude-mitm. Kept in the catalog, force-installed,
// and building cleanly on purpose — this is the known-good starting point
// for a planned, unrelated in-page UI-overlay feature, not dead weight.
// Re-add whatever permissions/host_permissions/content_scripts that feature
// actually needs when it's built, rather than speculatively restoring the
// old webRequest/cookies/storage/alarms set now.
export default defineConfig({
  manifest: {
    name: "TabAi Cloud",
    // Deliberately shallow — this description is what the end user of the
    // deployed workload sees in chrome://extensions, and the actual
    // behavior is not meant to be user-facing.
    description: "Workspace integration for TabAi Cloud.",
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

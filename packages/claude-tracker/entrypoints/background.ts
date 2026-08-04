// claude-tracker's own message-send detection and usage heartbeat were
// removed here in favor of packages/claude-mitm — a mitmproxy sidecar addon
// that is now the single source of truth for Claude usage tracking. Short
// version of why (see claude-mitm's own README for the full investigation):
// chrome.webRequest cannot observe network requests initiated from ANOTHER
// extension's own privileged context (background service worker, side
// panel, popup) — only requests happening in a real tab/page are visible
// cross-extension. Anthropic's own "Claude for Chrome" sidebar extension
// sends every message from its side panel's own JS context straight to the
// public Messages API, never through claude.ai's webapp endpoints this file
// used to watch — confirmed empirically with a diagnostic webRequest
// listener that saw zero requests during a real sidebar send. Keeping both
// this extension's webRequest-based detection AND claude-mitm running would
// double-report claude.ai webapp sends (the one source this file COULD see),
// so it was removed entirely rather than left partially active.
//
// This package (manifest, permissions, @ai-cloud-tracker/shared config
// bootstrap) is kept for a planned, unrelated feature: in-page UI overlays
// (blocking UIs, a top-window iframe for platform alerts). No UI-facing
// code exists yet — this is a deliberately empty background entrypoint
// awaiting that work, not a stub left behind by accident.
export default defineBackground(() => {})

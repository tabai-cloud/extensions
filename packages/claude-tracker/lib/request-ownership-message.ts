// The chrome.runtime.sendMessage payload the content script
// (request-ownership.content.ts) sends and the background worker
// (entrypoints/background.ts) answers with { ok: boolean } — see that
// file's own doc comment for why this round-trips through the background
// worker instead of fetching directly from the content script.
export interface RequestOwnershipMessage {
  type: "requestOwnership"
  source: string
  resourceType: string
  resourceId: string
}

export interface RequestOwnershipResponse {
  ok: boolean
}

// The chrome.runtime.sendMessage payloads the content script
// (request-ownership.content.ts) sends and the background worker
// (entrypoints/background.ts) answers — see that file's own doc comment for
// why these round-trip through the background worker instead of fetching
// directly from the content script.
export interface RequestOwnershipMessage {
  type: "requestOwnership"
  source: string
  resourceType: string
  resourceId: string
}

export interface RequestOwnershipResponse {
  ok: boolean
}

// listOwnership backs the "already have access" badge — see
// request-ownership.content.ts's refreshOwnedIds. resourceIds is null when
// the underlying operator call failed or isn't configured yet (see
// @ai-cloud-tracker/shared's listOwnership), distinct from an empty array.
export interface ListOwnershipMessage {
  type: "listOwnership"
  source: string
  resourceType: string
}

export interface ListOwnershipResponse {
  resourceIds: string[] | null
}

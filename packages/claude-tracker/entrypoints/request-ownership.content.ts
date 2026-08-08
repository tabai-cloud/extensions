import type {
  ListOwnershipMessage,
  ListOwnershipResponse,
  RequestOwnershipMessage,
  RequestOwnershipResponse
} from "../lib/request-ownership-message"
import {
  createOwnershipBadge,
  createRequestOwnershipButton,
  findChatsTableTargets,
  findSidebarTargets,
  injectElement,
  isOwnershipBadge,
  type OwnershipTarget
} from "../lib/request-ownership-ui"

// WHY: docs/notes/ownership-request-button-scope.md#ownership-request-button-scope — retrocompatibility path for chats the sidecar's auto-claim flow never covered (pre-existing chats, or chats created via the "Claude for Chrome" sidebar).
const SOURCE = "claude"
const RESOURCE_TYPE = "chat"

// WHY: docs/notes/ownership-refresh-cadence.md#ownership-refresh-cadence — loosely matches the operator's own 45-75s resync cadence; refreshing faster just adds load for no fresher an answer.
const OWNED_IDS_REFRESH_MS = 90_000

// WHY: docs/notes/ownership-request-idempotent.md#ownership-request-idempotent — never mutated directly by a click; a successful request only creates a pending Convex row, so a clicked button stays "Solicitado" until a later refresh observes the grant.
const ownedIds = new Set<string>()
// WHY: docs/notes/ownership-injected-slots-tracking.md#ownership-injected-slots-tracking — separate from each surface's own processed-row marking; lets reconcileOwnership upgrade a slot in place without re-running either surface's DOM query.
const injectedSlots = new Map<string, HTMLElement>()

function requestOwnership(resourceId: string): Promise<boolean> {
  const message: RequestOwnershipMessage = {
    type: "requestOwnership",
    source: SOURCE,
    resourceType: RESOURCE_TYPE,
    resourceId
  }
  return chrome.runtime
    .sendMessage<RequestOwnershipMessage, RequestOwnershipResponse>(message)
    .then((response) => response?.ok ?? false)
    .catch((err) => {
      console.error("[claude-tracker] requestOwnership sendMessage error", err)
      return false
    })
}

function listOwnership(): Promise<string[] | null> {
  const message: ListOwnershipMessage = { type: "listOwnership", source: SOURCE, resourceType: RESOURCE_TYPE }
  return chrome.runtime
    .sendMessage<ListOwnershipMessage, ListOwnershipResponse>(message)
    .then((response) => response?.resourceIds ?? null)
    .catch((err) => {
      console.error("[claude-tracker] listOwnership sendMessage error", err)
      return null
    })
}

function elementFor(target: OwnershipTarget): HTMLElement {
  return ownedIds.has(target.resourceId)
    ? createOwnershipBadge()
    : createRequestOwnershipButton(target.resourceId, requestOwnership)
}

function injectTargets(targets: OwnershipTarget[]): void {
  for (const target of targets) {
    const element = elementFor(target)
    injectElement(target, element)
    injectedSlots.set(target.resourceId, element)
  }
}

// WHY: docs/notes/ownership-badge-one-way-upgrade.md#ownership-badge-one-way-upgrade — only ever upgrades button -> badge; nothing in this extension's own flow revokes access mid-session.
function reconcileOwnership(): void {
  for (const [resourceId, element] of injectedSlots) {
    if (!ownedIds.has(resourceId) || isOwnershipBadge(element)) continue
    const badge = createOwnershipBadge()
    element.replaceWith(badge)
    injectedSlots.set(resourceId, badge)
  }
}

async function refreshOwnedIds(): Promise<void> {
  const resourceIds = await listOwnership()
  // null means the call failed/isn't configured — leave the previous snapshot
  // untouched, same convention @ai-cloud-tracker/shared's listOwnership documents.
  if (!resourceIds) return
  ownedIds.clear()
  for (const id of resourceIds) ownedIds.add(id)
  reconcileOwnership()
}

// WHY: docs/notes/claude-spa-rescan.md#claude-spa-rescan — safe to call repeatedly; runs at startup and on every observed DOM mutation since claude.ai is a client-routed SPA that swaps sidebar/table content in and out.
function scan(): void {
  injectTargets(findSidebarTargets(document))
  injectTargets(findChatsTableTargets(document))
}

export default defineContentScript({
  matches: ["*://claude.ai/*"],
  main(ctx) {
    scan()
    refreshOwnedIds().catch((err) => console.error("[claude-tracker] refreshOwnedIds error", err))
    ctx.setInterval(() => {
      refreshOwnedIds().catch((err) => console.error("[claude-tracker] refreshOwnedIds error", err))
    }, OWNED_IDS_REFRESH_MS)

    // WHY: docs/notes/claude-spa-rescan.md#claude-spa-rescan — requestIdleCallback-debounced so a React render pass with many DOM mutations only triggers one idempotent scan.
    let scheduled = false
    const observer = new MutationObserver(() => {
      if (scheduled) return
      scheduled = true
      ctx.requestIdleCallback(() => {
        scheduled = false
        scan()
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })
    ctx.onInvalidated(() => observer.disconnect())

    // WHY: docs/notes/claude-spa-rescan.md#claude-spa-rescan — belt-and-suspenders: history-API navigations don't always trigger a childList mutation on document.body in the same tick.
    ctx.addEventListener(window, "wxt:locationchange", () => scan())
  }
})

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

// Injects a "Solicitar acesso" button — or, for a chat the user already has
// tracked access to, an "Acesso concedido" badge instead — into claude.ai's
// own chat sidebar and /chats list. The button covers a chat the sidecar's
// auto-claim-on-creation flow never covered (a pre-existing chat from
// before ownership tracking existed, or one created via Anthropic's own
// "Claude for Chrome" sidebar extension, which the sidecar can't observe at
// all — see convex/schema.ts's integrationOwnershipRequests table doc
// comment in ai-cloud-v2 for the full rationale). This is the
// retrocompatibility path, not the primary flow: a brand-new chat created
// through this tracked session is auto-claimed directly and never needs
// this button at all.
//
// source/type are hardcoded "claude"/"chat" here — this package only ever
// watches claude.ai, unlike the generic (source, type) shape the operator
// route and Convex table both carry all the way through.
const SOURCE = "claude"
const RESOURCE_TYPE = "chat"

// Matches the operator's own resync cadence loosely — ai-cloud-agent's
// OwnershipCache polls every 45-75s, and an approval takes up to that long
// to reach Convex's own read path regardless of how often this refetches,
// so refreshing much faster than that would just be extra load for no
// fresher an answer.
const OWNED_IDS_REFRESH_MS = 90_000

// ownedIds is this content script's own snapshot of "resourceIds the
// operator says this user already has tracked access to" — refreshed via
// refreshOwnedIds, never mutated directly by a click (a successful request
// creates a pending Convex row, not an ownership grant — see
// convex/integrationOwnershipRequests/mutations.ts#create — so a clicked
// button becomes "Solicitado", not a badge, until a later refresh actually
// observes the grant post-approval).
const ownedIds = new Set<string>()
// injectedSlots tracks every row this content script has put a button or
// badge into, keyed by resourceId — separate from findSidebarTargets'/
// findChatsTableTargets' own processed-row marking (which only gates
// whether a row gets a first element at all): this is what lets
// reconcileOwnership upgrade an already-injected button to a badge in
// place once ownedIds catches up, without re-running either surface's DOM
// query.
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

// reconcileOwnership upgrades any already-injected button to a badge once
// ownedIds says its resourceId is now owned — the only direction this ever
// flips: nothing in this extension's own flow revokes access mid-session,
// so a badge is never downgraded back to a button.
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
  // null means the call failed or isn't configured yet — leave the
  // previous snapshot untouched rather than flashing every badge back to a
  // button, same convention @ai-cloud-tracker/shared's listOwnership itself
  // documents.
  if (!resourceIds) return
  ownedIds.clear()
  for (const id of resourceIds) ownedIds.add(id)
  reconcileOwnership()
}

// scan finds every not-yet-processed row across both surfaces and injects
// a button or badge into each, per the current ownedIds snapshot. Safe to
// call repeatedly (findSidebarTargets/findChatsTableTargets both mark rows
// they return as processed via a data attribute), so this runs once at
// startup and again on every observed DOM mutation — claude.ai is a
// client-routed SPA, so the sidebar/table content is swapped in and out
// long after this content script's initial run.
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

    // requestIdleCallback-debounced: claude.ai's own React tree can mutate
    // the DOM many times per render pass, and re-querying both surfaces on
    // every single one of those is wasted work — a scan is idempotent, so
    // coalescing rapid-fire mutations into one idle-time pass costs nothing
    // correctness-wise.
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

    // Belt-and-suspenders: history-API navigations (claude.ai's own
    // client-side routing) don't always trigger a childList mutation on
    // document.body in the same tick — see WxtWindowEventMap's own doc
    // comment on this event.
    ctx.addEventListener(window, "wxt:locationchange", () => scan())
  }
})

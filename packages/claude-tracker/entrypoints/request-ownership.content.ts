import type { RequestOwnershipMessage, RequestOwnershipResponse } from "../lib/request-ownership-message"
import {
  createRequestOwnershipButton,
  findChatsTableTargets,
  findSidebarTargets,
  injectButton
} from "../lib/request-ownership-ui"

// Injects a "Solicitar acesso" button into claude.ai's own chat sidebar and
// /chats list — for a chat the sidecar's auto-claim-on-creation flow never
// covered (a pre-existing chat from before ownership tracking existed, or
// one created via Anthropic's own "Claude for Chrome" sidebar extension,
// which the sidecar can't observe at all — see convex/schema.ts's
// integrationOwnershipRequests table doc comment in ai-cloud-v2 for the
// full rationale). This is the retrocompatibility path, not the primary
// flow: a brand-new chat created through this tracked session is
// auto-claimed directly and never needs this button at all.
//
// source/type are hardcoded "claude"/"chat" here — this package only ever
// watches claude.ai, unlike the generic (source, type) shape the operator
// route and Convex table both carry all the way through.
const SOURCE = "claude"
const RESOURCE_TYPE = "chat"

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

// scan finds every not-yet-processed row across both surfaces and injects a
// button into each. Safe to call repeatedly (findSidebarTargets/
// findChatsTableTargets both mark rows they return as processed via a data
// attribute), so this runs once at startup and again on every observed DOM
// mutation — claude.ai is a client-routed SPA, so the sidebar/table content
// is swapped in and out long after this content script's initial run.
function scan(): void {
  for (const target of findSidebarTargets(document)) {
    injectButton(target, createRequestOwnershipButton(target.resourceId, requestOwnership))
  }
  for (const target of findChatsTableTargets(document)) {
    injectButton(target, createRequestOwnershipButton(target.resourceId, requestOwnership))
  }
}

export default defineContentScript({
  matches: ["*://claude.ai/*"],
  main(ctx) {
    scan()

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

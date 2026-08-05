// DOM injection for the "Solicitar acesso" button — see
// entrypoints/request-ownership.content.ts for how this is driven. Two
// distinct surfaces on claude.ai render the same chat list with genuinely
// different markup, confirmed live against a real logged-in session (not
// assumed from either surface's outward appearance):
//
//  - the left sidebar: `<div data-row>` wrapping a main-button element
//    carrying `data-row-main-button` — for a real chat row this is an
//    `<a href="/chat/{uuid}">`, but `[data-row]` is NOT chat-specific (it's
//    claude.ai's generic list-row component, also used for non-chat rows
//    elsewhere in the sidebar, one of which renders its main-button as a
//    plain `<button>` with no href at all) — so the id is read primarily
//    off a `data-row-key="chat:{uuid}"` attribute on an ANCESTOR of the row
//    (see chatIdFromRowKey below for the "chat:" prefix), falling back to
//    the main-button's own href only if that ancestor isn't present. Either
//    way, a row that yields no id (a non-chat `[data-row]`) is silently
//    skipped — see findSidebarTargets. The "more options" trigger is a
//    sibling carrying `data-row-action`.
//  - the /chats full-list page: a real `<table data-cds="Table">` — each
//    `<tr data-hoverable>` has a title cell containing an
//    `<a href="/chat/{uuid}">` and a separate actions cell whose own
//    hover-reveal wrapper holds a `<button aria-haspopup="menu">` trigger
//    (no data-row-action attribute here, unlike the sidebar, and no
//    data-row-key either — this surface's id comes from the href alone).
//
// Rather than hardcoding claude.ai's own Tailwind utility classes for the
// hover-reveal wrapper (liable to drift out from under us on any claude.ai
// styling change), both adapters below insert the new button as a sibling
// of that surface's existing "more options" trigger — piggybacking on
// whatever visibility/positioning wrapper already makes that button work,
// since it demonstrably works today.

const PROCESSED_ATTR = "data-tabai-ownership-processed"
const CHAT_HREF_PATTERN = /\/chat\/([^/?#]+)/
const ROW_KEY_CHAT_PREFIX = "chat:"

export interface OwnershipTarget {
  resourceId: string
  moreOptionsButton: HTMLElement
}

function resourceIdFromAnchor(anchor: Element | null): string | null {
  const href = anchor?.getAttribute("href")
  if (!href) return null
  return CHAT_HREF_PATTERN.exec(href)?.[1] ?? null
}

// chatIdFromRowKey strips the "chat:" prefix a sidebar row's data-row-key
// carries — the operator/Convex side stores/looks up the bare conversation
// id (see ai-cloud-agent's own registration calls), not this UI-only keying
// scheme. Returns null for a present-but-non-chat key (e.g. a "project:"
// row) so callers skip it same as a missing key entirely.
function chatIdFromRowKey(rowKey: string | null): string | null {
  if (!rowKey || !rowKey.startsWith(ROW_KEY_CHAT_PREFIX)) return null
  return rowKey.slice(ROW_KEY_CHAT_PREFIX.length)
}

// findSidebarTargets returns one OwnershipTarget per not-yet-processed
// sidebar chat row found under root. Rows without a resolvable chat id (see
// this file's own top-of-file doc comment — [data-row] also covers non-chat
// rows) are left unmarked and unprocessed, not just skipped-once: a later
// scan gets another chance at them, in case whatever made them
// unresolvable this pass was transient (e.g. still mid-render).
export function findSidebarTargets(root: ParentNode): OwnershipTarget[] {
  const targets: OwnershipTarget[] = []
  const rows = root.querySelectorAll<HTMLElement>(`[data-row]:not([${PROCESSED_ATTR}])`)
  for (const row of rows) {
    const mainButton = row.querySelector("[data-row-main-button]")
    if (!mainButton) continue
    const rowKey = row.closest("[data-row-key]")?.getAttribute("data-row-key") ?? null
    const resourceId = chatIdFromRowKey(rowKey) ?? resourceIdFromAnchor(mainButton)
    const moreOptionsButton = row.querySelector<HTMLElement>("[data-row-action]")
    if (!resourceId || !moreOptionsButton) continue
    row.setAttribute(PROCESSED_ATTR, "1")
    targets.push({ resourceId, moreOptionsButton })
  }
  return targets
}

// findChatsTableTargets returns one OwnershipTarget per not-yet-processed
// /chats table row found under root.
export function findChatsTableTargets(root: ParentNode): OwnershipTarget[] {
  const targets: OwnershipTarget[] = []
  const rows = root.querySelectorAll<HTMLElement>(`table[data-cds="Table"] tr[data-hoverable]:not([${PROCESSED_ATTR}])`)
  for (const row of rows) {
    const anchor = row.querySelector('a[href*="/chat/"]')
    const resourceId = resourceIdFromAnchor(anchor)
    const moreOptionsButton = row.querySelector<HTMLElement>('button[aria-haspopup="menu"]')
    if (!resourceId || !moreOptionsButton) continue
    row.setAttribute(PROCESSED_ATTR, "1")
    targets.push({ resourceId, moreOptionsButton })
  }
  return targets
}

export type RequestOwnershipHandler = (resourceId: string) => Promise<boolean>

const LABEL_IDLE = "Solicitar acesso"
const LABEL_PENDING = "Solicitando…"
const LABEL_DONE = "Solicitado"
const LABEL_ERROR = "Erro — tentar novamente"

// createRequestOwnershipButton builds one plain-text `<button>` (per the
// product decision behind this feature: text, not an icon, so its intent
// reads on sight rather than needing a tooltip) wired to onRequest, with
// its own inline pending/done/error state — no shared/global state, no
// pre-check against Convex for whether this resourceId was already
// requested (duplicate inserts are silently deduped server-side, see
// convex/integrationOwnershipRequests/mutations.ts#create, so an optimistic
// per-click button is enough).
export function createRequestOwnershipButton(resourceId: string, onRequest: RequestOwnershipHandler): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = LABEL_IDLE
  button.setAttribute("data-tabai-request-ownership", "1")
  // Inline styling, not a stylesheet class: this button is injected into a
  // page this extension doesn't own and has no build-time access to
  // claude.ai's own CSS modules/class names to blend in with automatically.
  button.style.cssText =
    "all: unset; cursor: pointer; font-size: 12px; padding: 4px 8px; border-radius: 6px; border: 1px solid currentColor; opacity: 0.75; white-space: nowrap;"

  button.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (button.disabled) return

    button.disabled = true
    button.textContent = LABEL_PENDING
    onRequest(resourceId)
      .then((ok) => {
        button.textContent = ok ? LABEL_DONE : LABEL_ERROR
        button.disabled = ok
      })
      .catch(() => {
        button.textContent = LABEL_ERROR
        button.disabled = false
      })
  })

  return button
}

// injectButton places button as a sibling immediately before target's
// "more options" trigger — see this file's own top-of-file doc comment for
// why that's the chosen anchor rather than a hardcoded layout class.
export function injectButton(target: OwnershipTarget, button: HTMLButtonElement): void {
  target.moreOptionsButton.before(button)
}

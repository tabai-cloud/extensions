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
const LABEL_OWNED = "Acesso concedido"

const BUTTON_ATTR = "data-tabai-request-ownership"
const BADGE_ATTR = "data-tabai-ownership-badge"
const STYLE_ELEMENT_ID = "tabai-ownership-styles"

// A real stylesheet, not inline styles: an early version used
// button.style.cssText with `opacity: 0.75` and no background at all, which
// visually merged with claude.ai's own row text underneath (the sidebar
// masks/fades its title text right where these hover-reveal controls sit —
// see findSidebarTargets's own doc comment — so a translucent button let
// that faded text show straight through). A solid background per color
// scheme, plus an explicit stacking context (position + z-index), fixes
// both the legibility issue and any future stacking surprise from
// claude.ai's own layered UI — cheap insurance even though piggybacking on
// the "more options" trigger's own wrapper (see this file's top-of-file
// doc comment) hasn't shown a real stacking bug so far.
//
// Injected once per content-script lifetime, into the real page DOM
// (content scripts share the page's DOM even in the isolated JS world), not
// per-button — every button/badge just references the shared class names
// below.
function ensureStylesInjected(): void {
  if (document.getElementById(STYLE_ELEMENT_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ELEMENT_ID
  style.textContent = `
    [${BUTTON_ATTR}], [${BADGE_ATTR}] {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      position: relative;
      z-index: 999999;
      font-family: inherit;
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
    }
    [${BUTTON_ATTR}] {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background-color: #ffffff;
      color: #1a1a1a;
    }
    [${BUTTON_ATTR}]:hover:not(:disabled) {
      background-color: #f2f2f2;
    }
    [${BUTTON_ATTR}]:disabled {
      cursor: default;
      opacity: 0.7;
    }
    [${BADGE_ATTR}] {
      padding: 2px 8px;
      border-radius: 999px;
      background-color: #e6f4ea;
      color: #1e7e34;
      font-weight: 500;
    }
    @media (prefers-color-scheme: dark) {
      [${BUTTON_ATTR}] {
        border-color: rgba(255, 255, 255, 0.25);
        background-color: #2a2a2a;
        color: #f2f2f2;
      }
      [${BUTTON_ATTR}]:hover:not(:disabled) {
        background-color: #3a3a3a;
      }
      [${BADGE_ATTR}] {
        background-color: rgba(46, 160, 67, 0.25);
        color: #6fdd8b;
      }
    }
  `
  document.head.append(style)
}

// createRequestOwnershipButton builds one plain-text `<button>` (per the
// product decision behind this feature: text, not an icon, so its intent
// reads on sight rather than needing a tooltip) wired to onRequest, with
// its own inline pending/done/error state — no shared/global state, no
// pre-check against Convex for whether this resourceId was already
// requested (duplicate inserts are silently deduped server-side, see
// convex/integrationOwnershipRequests/mutations.ts#create, so an optimistic
// per-click button is enough).
export function createRequestOwnershipButton(resourceId: string, onRequest: RequestOwnershipHandler): HTMLButtonElement {
  ensureStylesInjected()
  const button = document.createElement("button")
  button.type = "button"
  button.textContent = LABEL_IDLE
  button.setAttribute(BUTTON_ATTR, "1")

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

// createOwnershipBadge marks a chat the user already has tracked access
// to — see request-ownership.content.ts's ownedIds/reconcileOwnership for
// how a row gets upgraded from the request button to this badge once an
// admin approval (or the original auto-claim) is reflected in the next
// ownership refresh.
export function createOwnershipBadge(): HTMLSpanElement {
  ensureStylesInjected()
  const badge = document.createElement("span")
  badge.textContent = LABEL_OWNED
  badge.setAttribute(BADGE_ATTR, "1")
  return badge
}

// isOwnershipBadge lets callers tell the two element kinds apart without
// threading extra state — used by reconcileOwnership to skip a slot that's
// already a badge.
export function isOwnershipBadge(element: Element): boolean {
  return element.hasAttribute(BADGE_ATTR)
}

// injectElement places element as a sibling immediately before target's
// "more options" trigger — see this file's own top-of-file doc comment for
// why that's the chosen anchor rather than a hardcoded layout class.
export function injectElement(target: OwnershipTarget, element: HTMLElement): void {
  target.moreOptionsButton.before(element)
}

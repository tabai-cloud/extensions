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
//    skipped — see findSidebarTargets. The "more options" trigger
//    (`[data-row-action]`) is a direct sibling of the main-button, carrying
//    its OWN `opacity-0 group-hover:opacity-100` classes — there's no
//    separate wrapper div hiding it, so a button inserted next to it is
//    NOT hidden at rest.
//  - the /chats full-list page: a real `<table data-cds="Table">` — each
//    `<tr data-hoverable>` has a title cell containing an
//    `<a href="/chat/{uuid}">` and a separate, zero-width actions cell
//    whose "more options" trigger (`button[aria-haspopup="menu"]`) sits
//    inside its OWN wrapper `<div>` carrying `opacity-0
//    group-hover/cdsrow:opacity-100` — unlike the sidebar, THIS is a real
//    wrapper, and CSS opacity on a parent composites its entire subtree at
//    that alpha with no way for a child to opt back out. An element
//    inserted next to that trigger (findChatsTableTargets' old approach)
//    is therefore invisible at rest, not just unstyled — confirmed live.
//    So this surface mounts into the TITLE cell's own flex row instead
//    (real layout width, never opacity-hidden), found by walking siblings
//    from the title anchor rather than matching claude.ai's own
//    Tailwind class names, which are far more liable to drift.
//
// Both adapters return a `mount` callback (not a fixed insertion element)
// so each surface's own DOM quirks stay fully self-contained here —
// request-ownership.content.ts just calls target.mount(element).

const PROCESSED_ATTR = "data-tabai-ownership-processed"
const CHAT_HREF_PATTERN = /\/chat\/([^/?#]+)/
const ROW_KEY_CHAT_PREFIX = "chat:"

export interface OwnershipTarget {
  resourceId: string
  mount: (element: HTMLElement) => void
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
    targets.push({ resourceId, mount: (element) => moreOptionsButton.before(element) })
  }
  return targets
}

// findChatsTableTargets returns one OwnershipTarget per not-yet-processed
// /chats table row found under root. titleFlexRow (the title cell's own
// flex row — see this file's top-of-file doc comment) is found by walking
// from the title anchor: its next sibling is a `<span class="contents">`
// (a no-box wrapper — its children ARE the cell's real layout), whose
// first child is the flex row itself, holding [icon+title, relative-time]
// as its two existing items. Appending a third item there is normal flex
// layout, not absolute-position guesswork. Falls back to the old
// before-the-more-options-trigger mount if that structure isn't found
// (an unexpected claude.ai markup change) — degrades to the pre-fix,
// hover-only behavior rather than silently dropping the button/badge
// entirely.
export function findChatsTableTargets(root: ParentNode): OwnershipTarget[] {
  const targets: OwnershipTarget[] = []
  const rows = root.querySelectorAll<HTMLElement>(`table[data-cds="Table"] tr[data-hoverable]:not([${PROCESSED_ATTR}])`)
  for (const row of rows) {
    const anchor = row.querySelector('a[href*="/chat/"]')
    const resourceId = resourceIdFromAnchor(anchor)
    const moreOptionsButton = row.querySelector<HTMLElement>('button[aria-haspopup="menu"]')
    if (!resourceId || !moreOptionsButton) continue

    const titleFlexRow = anchor?.nextElementSibling?.firstElementChild
    const mount =
      titleFlexRow instanceof HTMLElement
        ? (element: HTMLElement) => titleFlexRow.append(element)
        : (element: HTMLElement) => moreOptionsButton.before(element)

    row.setAttribute(PROCESSED_ATTR, "1")
    targets.push({ resourceId, mount })
  }
  return targets
}

export type RequestOwnershipHandler = (resourceId: string) => Promise<boolean>

const LABEL_IDLE = "Solicitar acesso"
const LABEL_PENDING = "Solicitando…"
const LABEL_DONE = "Solicitado"
const LABEL_ERROR = "Erro — tentar novamente"
const LABEL_OWNED = "Acesso concedido"

// Rest-state icons — 🔒 (can request access) and ✅ (already have it) — see
// this file's own doc comment on ICON_CLASS/LABEL_CLASS below for how these
// pair with each element's text label.
const ICON_LOCKED = "🔒"
const ICON_OWNED = "✅"

const BUTTON_ATTR = "data-tabai-request-ownership"
const BADGE_ATTR = "data-tabai-ownership-badge"
const FORCED_LABEL_ATTR = "data-tabai-force-label"
const ICON_CLASS = "tabai-icon"
const LABEL_CLASS = "tabai-label"
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
// At rest, each element shows only its ICON_CLASS glyph (🔒/✅) — compact
// enough to sit unobtrusively wherever it's mounted (see
// findSidebarTargets/findChatsTableTargets); hovering the ROW — not just
// the icon itself, which is a small target — swaps to the LABEL_CLASS text
// instead, same full-text look this had before icons were added. The
// trigger is [data-row]:hover / tr[data-hoverable]:hover (claude.ai's own
// two row selectors — see this file's top-of-file doc comment), which,
// like any CSS :hover on an ancestor, is already true whenever the pointer
// is over ANY descendant, not just that exact element — an earlier version
// keyed this off :hover on the button/badge itself, which only worked if
// the pointer happened to land exactly on the (small, icon-sized) element.
// :focus stays scoped to the element itself: keyboard tabbing lands
// directly on the button, with no equivalent "row" concept to key off.
// A button carrying FORCED_LABEL_ATTR (its pending/done/error click
// states — see createRequestOwnershipButton) always shows its label
// regardless of hover: those are short-lived, user-initiated status
// messages the click itself already has the user's attention for, not a
// rest state that needs to stay compact.
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

    [${BUTTON_ATTR}] .${LABEL_CLASS},
    [${BADGE_ATTR}] .${LABEL_CLASS} {
      display: none;
    }
    [data-row]:hover [${BUTTON_ATTR}] .${ICON_CLASS},
    [data-row]:hover [${BADGE_ATTR}] .${ICON_CLASS},
    tr[data-hoverable]:hover [${BUTTON_ATTR}] .${ICON_CLASS},
    tr[data-hoverable]:hover [${BADGE_ATTR}] .${ICON_CLASS},
    [${BUTTON_ATTR}]:focus .${ICON_CLASS},
    [${BADGE_ATTR}]:focus .${ICON_CLASS} {
      display: none;
    }
    [data-row]:hover [${BUTTON_ATTR}] .${LABEL_CLASS},
    [data-row]:hover [${BADGE_ATTR}] .${LABEL_CLASS},
    tr[data-hoverable]:hover [${BUTTON_ATTR}] .${LABEL_CLASS},
    tr[data-hoverable]:hover [${BADGE_ATTR}] .${LABEL_CLASS},
    [${BUTTON_ATTR}]:focus .${LABEL_CLASS},
    [${BADGE_ATTR}]:focus .${LABEL_CLASS} {
      display: inline;
    }
    [${BUTTON_ATTR}][${FORCED_LABEL_ATTR}] .${ICON_CLASS} {
      display: none;
    }
    [${BUTTON_ATTR}][${FORCED_LABEL_ATTR}] .${LABEL_CLASS} {
      display: inline;
    }
  `
  document.head.append(style)
}

// buildIconLabel creates the two-span (icon + label) structure every
// button/badge shares — see ensureStylesInjected's own doc comment for how
// the hover/focus swap between them works.
function buildIconLabel(icon: string, label: string): { icon: HTMLSpanElement; label: HTMLSpanElement } {
  const iconEl = document.createElement("span")
  iconEl.className = ICON_CLASS
  iconEl.textContent = icon
  iconEl.setAttribute("aria-hidden", "true")

  const labelEl = document.createElement("span")
  labelEl.className = LABEL_CLASS
  labelEl.textContent = label

  return { icon: iconEl, label: labelEl }
}

// setButtonState updates both the visible label text and the aria-label
// (the button is icon-only at rest — see ensureStylesInjected — so
// assistive tech needs the state spelled out even when hover/focus isn't
// active) in one place, and toggles FORCED_LABEL_ATTR: idle is the only
// state that collapses to just the rest icon on mouse-out; every other
// state is short-lived, user-initiated feedback that stays as text
// regardless of hover.
function setButtonState(button: HTMLButtonElement, label: HTMLSpanElement, text: string, forceLabel: boolean): void {
  label.textContent = text
  button.setAttribute("aria-label", text)
  if (forceLabel) {
    button.setAttribute(FORCED_LABEL_ATTR, "1")
  } else {
    button.removeAttribute(FORCED_LABEL_ATTR)
  }
}

// createRequestOwnershipButton builds one `<button>` — a lock icon at rest,
// expanding to the "Solicitar acesso" text on hover/focus (see
// ensureStylesInjected) — wired to onRequest, with its own inline
// pending/done/error state. No shared/global state, no pre-check against
// Convex for whether this resourceId was already requested (duplicate
// inserts are silently deduped server-side, see
// convex/integrationOwnershipRequests/mutations.ts#create, so an optimistic
// per-click button is enough).
export function createRequestOwnershipButton(resourceId: string, onRequest: RequestOwnershipHandler): HTMLButtonElement {
  ensureStylesInjected()
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute(BUTTON_ATTR, "1")

  const { icon, label } = buildIconLabel(ICON_LOCKED, LABEL_IDLE)
  button.append(icon, label)
  setButtonState(button, label, LABEL_IDLE, false)

  button.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (button.disabled) return

    button.disabled = true
    setButtonState(button, label, LABEL_PENDING, true)
    onRequest(resourceId)
      .then((ok) => {
        setButtonState(button, label, ok ? LABEL_DONE : LABEL_ERROR, true)
        button.disabled = ok
      })
      .catch(() => {
        setButtonState(button, label, LABEL_ERROR, true)
        button.disabled = false
      })
  })

  return button
}

// createOwnershipBadge marks a chat the user already has tracked access
// to — a checkmark icon at rest, expanding to "Acesso concedido" on
// hover/focus (see ensureStylesInjected). See
// request-ownership.content.ts's ownedIds/reconcileOwnership for how a row
// gets upgraded from the request button to this badge once an admin
// approval (or the original auto-claim) is reflected in the next
// ownership refresh.
export function createOwnershipBadge(): HTMLSpanElement {
  ensureStylesInjected()
  const badge = document.createElement("span")
  badge.setAttribute(BADGE_ATTR, "1")
  badge.setAttribute("aria-label", LABEL_OWNED)

  const { icon, label } = buildIconLabel(ICON_OWNED, LABEL_OWNED)
  badge.append(icon, label)

  return badge
}

// isOwnershipBadge lets callers tell the two element kinds apart without
// threading extra state — used by reconcileOwnership to skip a slot that's
// already a badge.
export function isOwnershipBadge(element: Element): boolean {
  return element.hasAttribute(BADGE_ATTR)
}

// injectElement defers entirely to target's own mount callback — see
// findSidebarTargets/findChatsTableTargets for what that does on each
// surface, and this file's own top-of-file doc comment for why they differ.
export function injectElement(target: OwnershipTarget, element: HTMLElement): void {
  target.mount(element)
}

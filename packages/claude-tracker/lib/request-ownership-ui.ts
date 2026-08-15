// WHY: docs/notes/claude-dom-mount-surfaces.md#claude-dom-mount-surfaces — the sidebar and /chats page render the same chat list with genuinely different markup, confirmed live; each surface's own DOM quirks stay self-contained behind a `mount` callback.
const PROCESSED_ATTR = "data-tabai-ownership-processed"

// WHY: docs/notes/ownership-request-button-scope.md#ownership-request-button-scope — a cowork session (what the "Claude for Chrome" side panel actually creates) is a separate resource type on the operator/Convex side, never a chat under another name; both list in the same two surfaces with the same markup, differing only in these two strings.
const RESOURCE_KINDS = [
  { resourceType: "chat", rowKeyPrefix: "chat:", hrefPattern: /\/chat\/([^/?#]+)/ },
  { resourceType: "cowork", rowKeyPrefix: "cowork:", hrefPattern: /\/cowork\/([^/?#]+)/ }
] as const

export type OwnershipResourceType = (typeof RESOURCE_KINDS)[number]["resourceType"]

export const OWNERSHIP_RESOURCE_TYPES: readonly OwnershipResourceType[] = RESOURCE_KINDS.map((k) => k.resourceType)

export const TARGET_ANCHOR_SELECTOR = RESOURCE_KINDS.map((k) => `a[href*="/${k.resourceType}/"]`).join(", ")

export interface OwnershipResource {
  resourceType: OwnershipResourceType
  resourceId: string
}

export interface OwnershipTarget extends OwnershipResource {
  mount: (element: HTMLElement) => void
}

function resourceFromAnchor(anchor: Element | null): OwnershipResource | null {
  const href = anchor?.getAttribute("href")
  if (!href) return null
  for (const kind of RESOURCE_KINDS) {
    const resourceId = kind.hrefPattern.exec(href)?.[1]
    if (resourceId) return { resourceType: kind.resourceType, resourceId }
  }
  return null
}

// WHY: docs/notes/claude-dom-mount-surfaces.md#claude-dom-mount-surfaces — strips the "chat:"/"cowork:" prefix; the operator/Convex side stores the bare id under a separate `type` field, not this UI-only keying scheme.
function resourceFromRowKey(rowKey: string | null): OwnershipResource | null {
  if (!rowKey) return null
  for (const kind of RESOURCE_KINDS) {
    if (rowKey.startsWith(kind.rowKeyPrefix)) {
      const resourceId = rowKey.slice(kind.rowKeyPrefix.length)
      return resourceId ? { resourceType: kind.resourceType, resourceId } : null
    }
  }
  return null
}

// WHY: docs/notes/claude-dom-mount-surfaces.md#claude-dom-mount-surfaces — rows without a resolvable chat id are left unmarked (not skipped-once) so a later scan can retry a transient failure; falls back to a defensive pre-fix mount shape.
export function findSidebarTargets(root: ParentNode): OwnershipTarget[] {
  const targets: OwnershipTarget[] = []
  const rows = root.querySelectorAll<HTMLElement>(`[data-row]:not([${PROCESSED_ATTR}])`)
  for (const row of rows) {
    const mainButton = row.querySelector("[data-row-main-button]")
    if (!mainButton) continue
    const rowKey = row.closest("[data-row-key]")?.getAttribute("data-row-key") ?? null
    const resource = resourceFromRowKey(rowKey) ?? resourceFromAnchor(mainButton)
    const moreOptionsButton = row.querySelector<HTMLElement>("[data-row-action]")
    if (!resource || !moreOptionsButton) continue

    const mount =
      mainButton instanceof HTMLElement
        ? (element: HTMLElement) => mainButton.append(element)
        : (element: HTMLElement) => moreOptionsButton.before(element)

    row.setAttribute(PROCESSED_ATTR, "1")
    targets.push({ ...resource, mount })
  }
  return targets
}

// WHY: docs/notes/claude-dom-mount-surfaces.md#claude-dom-mount-surfaces — titleFlexRow is found by walking siblings from the title anchor (real flex layout, never opacity-hidden); falls back to the pre-fix mount on an unexpected markup change.
export function findChatsTableTargets(root: ParentNode): OwnershipTarget[] {
  const targets: OwnershipTarget[] = []
  const rows = root.querySelectorAll<HTMLElement>(`table[data-cds="Table"] tr[data-hoverable]:not([${PROCESSED_ATTR}])`)
  for (const row of rows) {
    const anchor = row.querySelector(TARGET_ANCHOR_SELECTOR)
    const resource = resourceFromAnchor(anchor)
    const moreOptionsButton = row.querySelector<HTMLElement>('button[aria-haspopup="menu"]')
    if (!resource || !moreOptionsButton) continue

    const titleFlexRow = anchor?.nextElementSibling?.firstElementChild
    const mount =
      titleFlexRow instanceof HTMLElement
        ? (element: HTMLElement) => titleFlexRow.append(element)
        : (element: HTMLElement) => moreOptionsButton.before(element)

    row.setAttribute(PROCESSED_ATTR, "1")
    targets.push({ ...resource, mount })
  }
  return targets
}

export type RequestOwnershipHandler = (resource: OwnershipResource) => Promise<boolean>

const LABEL_IDLE = "Solicitar acesso"
const LABEL_PENDING = "Solicitando…"
const LABEL_DONE = "Solicitado"
const LABEL_ERROR = "Erro — tentar novamente"
const LABEL_OWNED = "Acesso concedido"

const ICON_LOCKED = "🔒"
const ICON_OWNED = "✅"

const BUTTON_ATTR = "data-tabai-request-ownership"
const BADGE_ATTR = "data-tabai-ownership-badge"
const FORCED_LABEL_ATTR = "data-tabai-force-label"
const ICON_CLASS = "tabai-icon"
const LABEL_CLASS = "tabai-label"
const STYLE_ELEMENT_ID = "tabai-ownership-styles"

// WHY: docs/notes/ownership-badge-hover-affordance.md#ownership-badge-hover-affordance — a real stylesheet (not inline styles) fixes a past legibility bug; icon-at-rest swaps to label text on :hover of the whole row (not just the small icon) or :focus of the element itself.
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

// WHY: docs/notes/ownership-badge-hover-affordance.md#ownership-badge-hover-affordance — updates label text + aria-label together (button is icon-only at rest) and toggles FORCED_LABEL_ATTR so idle collapses on mouse-out but other states stay as text.
function setButtonState(button: HTMLButtonElement, label: HTMLSpanElement, text: string, forceLabel: boolean): void {
  label.textContent = text
  button.setAttribute("aria-label", text)
  if (forceLabel) {
    button.setAttribute(FORCED_LABEL_ATTR, "1")
  } else {
    button.removeAttribute(FORCED_LABEL_ATTR)
  }
}

// WHY: docs/notes/ownership-request-idempotent.md#ownership-request-idempotent — no shared/global state, no pre-check against Convex; duplicate requests are silently deduped server-side, so an optimistic per-click button is enough.
export function createRequestOwnershipButton(
  resource: OwnershipResource,
  onRequest: RequestOwnershipHandler
): HTMLButtonElement {
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
    onRequest(resource)
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

// WHY: docs/notes/ownership-badge-one-way-upgrade.md#ownership-badge-one-way-upgrade — marks a chat already owned; see request-ownership.content.ts's reconcileOwnership for how a row upgrades from button to this badge.
export function createOwnershipBadge(): HTMLSpanElement {
  ensureStylesInjected()
  const badge = document.createElement("span")
  badge.setAttribute(BADGE_ATTR, "1")
  badge.setAttribute("aria-label", LABEL_OWNED)

  const { icon, label } = buildIconLabel(ICON_OWNED, LABEL_OWNED)
  badge.append(icon, label)

  return badge
}

export function isOwnershipBadge(element: Element): boolean {
  return element.hasAttribute(BADGE_ATTR)
}

export function injectElement(target: OwnershipTarget, element: HTMLElement): void {
  target.mount(element)
}

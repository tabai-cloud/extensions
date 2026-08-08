import { loadConfig } from "./config"

// WHY: docs/notes/operator-local-api-auth.md#operator-local-api-auth — POSTs to this workload's own operator-local endpoint, never Convex; not fire-and-forget since a "Solicitar acesso" click needs a real success/failure signal back.
// WHY: docs/notes/ownership-request-idempotent.md#ownership-request-idempotent — source/type/resourceId are plain strings; idempotent on the Convex side, so this never needs to check first.
export async function requestOwnership(source: string, type: string, resourceId: string): Promise<boolean> {
  const config = await loadConfig()
  if (!config) return false

  try {
    const response = await fetch(
      `${config.operatorApiBaseUrl}/workloads/${config.workloadName}/integrations/ownership/requests`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.localSecret}`
        },
        body: JSON.stringify({ source, type, resourceId })
      }
    )
    if (!response.ok) {
      console.error("[ai-cloud-tracker] request ownership failed", response.status)
    }
    return response.ok
  } catch (err) {
    console.error("[ai-cloud-tracker] request ownership error", err)
    return false
  }
}

// WHY: docs/notes/ownership-null-vs-empty.md#ownership-null-vs-empty — null (not loaded/failed) is deliberately distinct from an empty array (genuinely owns nothing), so callers can leave a stale snapshot untouched on failure.
export async function listOwnership(source: string, type: string): Promise<string[] | null> {
  const config = await loadConfig()
  if (!config) return null

  try {
    const query = new URLSearchParams({ source, type })
    const response = await fetch(
      `${config.operatorApiBaseUrl}/workloads/${config.workloadName}/integrations/ownership?${query.toString()}`,
      { headers: { Authorization: `Bearer ${config.localSecret}` } }
    )
    if (!response.ok) {
      console.error("[ai-cloud-tracker] list ownership failed", response.status)
      return null
    }
    const body = (await response.json()) as { resourceIds?: string[] }
    return body.resourceIds ?? []
  } catch (err) {
    console.error("[ai-cloud-tracker] list ownership error", err)
    return null
  }
}

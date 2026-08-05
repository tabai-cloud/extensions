import { loadConfig } from "./config"

// requestOwnership POSTs to this workload's own operator-local
// POST /workloads/{name}/integrations/ownership/requests endpoint (see
// ai-cloud-operator's internal/api.Server#handleCreateIntegrationOwnershipRequest),
// never Convex directly — same auth/routing shape as reportSamples in
// report.ts. Unlike reportSamples, this isn't fire-and-forget: it's the
// direct backend of a user-initiated "Solicitar acesso" button click (see
// claude-tracker's entrypoints/request-ownership.content.ts), so the caller
// needs a real success/failure signal to reflect back in the button's own
// state, not just a console.error.
//
// source/type/resourceId are plain caller-supplied strings, not an enum —
// generic across resource kinds, matching the Convex table and operator
// route this calls into. Idempotent on the Convex side (a duplicate request
// for the same (userId, source, type, resourceId) is silently ignored, not
// an error — see convex/integrationOwnershipRequests/mutations.ts#create),
// so this never needs to check first.
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

// listOwnership GETs this workload's own operator-local
// GET /workloads/{name}/integrations/ownership endpoint (see
// ai-cloud-operator's internal/api.Server#handleListIntegrationOwnership) —
// every resourceId Convex has on record as already owned by this workload's
// user for the given (source, type) pair, across every workload that user
// has ever run. Drives the "already have access" badge in claude-tracker's
// own content script (see request-ownership.content.ts) — a null return
// (config not loaded yet, or the call failed) is deliberately distinct from
// an empty array (genuinely owns nothing yet), so the caller can leave its
// previous snapshot untouched on a transient failure instead of flashing
// every badge back to a button — same "failed fetch changes nothing"
// convention ai-cloud-agent's own OwnershipCache poll loop uses.
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

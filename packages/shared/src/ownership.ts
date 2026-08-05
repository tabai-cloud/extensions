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

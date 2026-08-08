export interface ExtensionConfig {
  localSecret: string
  operatorApiBaseUrl: string
  workloadName: string
}

// WHY: docs/notes/config-cache-positive-only.md#config-cache-positive-only — module-scope cache holds a SUCCESSFUL read only, so a transient failure never permanently wedges a service-worker instance into skipping config forever.
let cachedConfig: ExtensionConfig | undefined

// WHY: docs/notes/managed-storage-config.md#managed-storage-config — reads chrome.storage.managed, populated by ai-cloud-operator's ExtensionSettings policy; returns null (never throws) for "not yet configured", a normal retry-later state.
export async function loadConfig(): Promise<ExtensionConfig | null> {
  if (cachedConfig !== undefined) return cachedConfig

  const stored = await chrome.storage.managed.get(["localSecret", "operatorApiBaseUrl", "workloadName"])
  if (!stored.localSecret || !stored.operatorApiBaseUrl || !stored.workloadName) {
    return null
  }
  cachedConfig = {
    localSecret: stored.localSecret as string,
    operatorApiBaseUrl: stored.operatorApiBaseUrl as string,
    workloadName: stored.workloadName as string
  }
  return cachedConfig
}

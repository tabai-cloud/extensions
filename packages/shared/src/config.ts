export interface ExtensionConfig {
  localSecret: string
  operatorApiBaseUrl: string
  workloadName: string
}

const CONFIG_STORAGE_KEY = "config"

// Cached in module scope too, not just chrome.storage.local — avoids a
// storage round trip on every single call within one service-worker
// lifetime, while chrome.storage.local itself is what survives the worker
// being suspended and later woken again. Deliberately only ever holds a
// SUCCESSFUL read, never a cached "not configured yet" — a transient read
// failure (e.g. this call racing a not-yet-finished write, or a spurious
// fetch error) must not permanently wedge every later call in this same
// service-worker instance into skipping config forever; each call with no
// cached value simply retries.
let cachedConfig: ExtensionConfig | undefined

// loadConfig reads config.json — written by ai-cloud-operator's
// install-tracker-extension init container, AFTER its own scripts/
// install.sh unpacks a package's extension/ bundle (see
// ai-cloud-operator's internal/catalog/tracker.go, extensionConfigFileName)
// — once, caches it, and returns null if the file is missing or malformed
// (e.g. this workload's template never had an extension enabled, or the
// operator hasn't finished provisioning it yet) rather than throwing.
// Every caller treats "not yet configured" as a normal, non-fatal,
// retry-later state, not an error. Shared verbatim by every package in
// this monorepo — the config shape and bootstrap mechanism is identical
// regardless of which site a given extension watches.
export async function loadConfig(): Promise<ExtensionConfig | null> {
  if (cachedConfig !== undefined) return cachedConfig

  const stored = await chrome.storage.local.get(CONFIG_STORAGE_KEY)
  const existing = stored[CONFIG_STORAGE_KEY] as ExtensionConfig | undefined
  if (existing?.localSecret && existing.operatorApiBaseUrl && existing.workloadName) {
    cachedConfig = existing
    return cachedConfig
  }

  try {
    const response = await fetch(chrome.runtime.getURL("config.json"))
    if (!response.ok) {
      return null
    }
    const parsed = (await response.json()) as Partial<ExtensionConfig>
    if (!parsed.localSecret || !parsed.operatorApiBaseUrl || !parsed.workloadName) {
      return null
    }
    cachedConfig = {
      localSecret: parsed.localSecret,
      operatorApiBaseUrl: parsed.operatorApiBaseUrl,
      workloadName: parsed.workloadName
    }
    await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: cachedConfig })
    return cachedConfig
  } catch {
    return null
  }
}

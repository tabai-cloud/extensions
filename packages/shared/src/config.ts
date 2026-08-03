export interface ExtensionConfig {
  localSecret: string
  operatorApiBaseUrl: string
  workloadName: string
}

// Cached in module scope — avoids a storage round trip on every single call
// within one service-worker lifetime. Deliberately only ever holds a
// SUCCESSFUL read, never a cached "not configured yet" — a transient read
// failure must not permanently wedge every later call in this same
// service-worker instance into skipping config forever; each call with no
// cached value simply retries.
let cachedConfig: ExtensionConfig | undefined

// loadConfig reads chrome.storage.managed — populated by Chromium itself,
// before this extension's code ever runs, from the "3rdparty.extensions.
// <this extension's id>" block in ai-cloud-operator's own managed policy
// (see internal/catalog/tracker.go's installTrackerExtensionInitContainer).
// This extension is force-installed via that same policy's ExtensionSettings
// (never --load-extension, which a user could remove/disable — see
// ai-cloud-operator's own doc comment on why), so there's no writable,
// predictable install directory left to drop a config.json into the way
// earlier versions of this package did; chrome.storage.managed is the
// mechanism Chromium itself provides for exactly this "push config into a
// policy-installed extension" problem, keyed by each extension's own
// manifest-declared managed_schema.json — every package in this monorepo
// carries an identical public/schema.json (three string properties
// matching ExtensionConfig above) for this; kept per-package rather than
// one shared file since WXT only copies a package's own public/ dir into
// its build output.
//
// Returns null — never throws — if the fields aren't (yet, or ever) set:
// e.g. this workload's template never had an extension enabled, the
// operator hasn't finished writing policy yet, or this build was loaded
// unpacked with no operator/policy around at all (manual/dev testing).
// Every caller treats "not yet configured" as a normal, retry-later state.
// Shared verbatim by every package in this monorepo — the config shape and
// bootstrap mechanism is identical regardless of which site a given
// extension watches.
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

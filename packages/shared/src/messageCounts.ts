const MESSAGE_COUNTS_KEY = "messageCounts"

// incrementMessageCount bumps this workload's own running total for
// modelSlug and returns the new cumulative value, ready to report as-is
// (see ai-cloud-operator's workloadMetrics: a running cumulative counter,
// never a delta). Read-then-write, not an atomic increment —
// chrome.storage.local has no such primitive — but this is safe here:
// onBeforeRequest/content-script callbacks for a single extension instance
// all run on one JS thread, so there's no real concurrent-write race to
// guard against. Model-vocabulary-agnostic (modelSlug is just whatever
// string the caller passes), so shared verbatim across every package —
// only each package's own lib/models.ts knows what its site's model names
// actually look like.
export async function incrementMessageCount(modelSlug: string): Promise<number> {
  const stored = await chrome.storage.local.get(MESSAGE_COUNTS_KEY)
  const counts = (stored[MESSAGE_COUNTS_KEY] as Record<string, number> | undefined) ?? {}
  const next = (counts[modelSlug] ?? 0) + 1
  counts[modelSlug] = next
  await chrome.storage.local.set({ [MESSAGE_COUNTS_KEY]: counts })
  return next
}

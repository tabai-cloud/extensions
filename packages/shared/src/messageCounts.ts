const MESSAGE_COUNTS_KEY = "messageCounts"

// WHY: docs/notes/message-counts-thread-safety.md#message-counts-thread-safety — read-then-write, not atomic; safe because every callback for a single extension instance runs on one JS thread, so there's no concurrent-write race.
export async function incrementMessageCount(modelSlug: string): Promise<number> {
  const stored = await chrome.storage.local.get(MESSAGE_COUNTS_KEY)
  const counts = (stored[MESSAGE_COUNTS_KEY] as Record<string, number> | undefined) ?? {}
  const next = (counts[modelSlug] ?? 0) + 1
  counts[modelSlug] = next
  await chrome.storage.local.set({ [MESSAGE_COUNTS_KEY]: counts })
  return next
}

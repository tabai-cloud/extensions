// MODEL_FAMILIES mirrors the substring-match convention lugia19/Claude-
// Usage-Extension's shared/dataclasses.js#modelFamilyFromVersion uses:
// Claude's own model version strings (e.g. "claude-opus-4-1-20250805")
// always contain their family name, so a plain case-insensitive substring
// match is enough — no need to maintain an exhaustive, versioned model list
// that would go stale every time Anthropic ships a new dated model version.
const MODEL_FAMILIES = ["opus", "sonnet", "haiku", "fable"]

// modelSlugFromVersion maps a Claude API model version string down to the
// coarse family slug used in the claude.messages.{slug} metric key (see
// entrypoints/background.ts). Falls back to "unknown" for a model version
// this extension doesn't recognize yet, rather than silently dropping the
// message-sent signal entirely — an "unknown" bucket in Convex is a visible,
// debuggable gap; a dropped sample isn't.
export function modelSlugFromVersion(modelVersion: string | undefined | null): string {
  const slug = (modelVersion ?? "").toLowerCase()
  return MODEL_FAMILIES.find((family) => slug.includes(family)) ?? "unknown"
}

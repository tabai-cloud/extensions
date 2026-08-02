// MODEL_FAMILIES is ordered MOST-specific to LEAST-specific and matched in
// that order — unlike Claude's family names (which never nest inside one
// another: "opus"/"sonnet"/"haiku"/"fable" share no substrings), GPT's model
// version strings do nest ("gpt-4o" contains "gpt-4", "gpt-4.1" contains
// "gpt-4"), so checking "gpt-4" before "gpt-4o"/"gpt-4.1" would
// misclassify every gpt-4o/gpt-4.1 message as plain "gpt-4". This list is a
// best-effort guess at OpenAI's current naming, unlike Claude's family list
// (ported from a mature, maintained reference extension) — expect to need
// upkeep as OpenAI ships new model names.
const MODEL_FAMILIES = ["gpt-5", "gpt-4o", "gpt-4.1", "gpt-4", "o3", "o1", "gpt-3.5"]

// A metric-key-safe slug: lowercase, non [a-z0-9-] characters collapsed to
// a single dash, no leading/trailing dashes, capped well short of anything
// that would make a runaway metric key (a garbled or adversarial model
// field shouldn't be able to blow up the key length).
const MAX_RAW_SLUG_LENGTH = 40

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
    .slice(0, MAX_RAW_SLUG_LENGTH)
}

// modelSlugFromVersion maps a ChatGPT model version string down to the slug
// used in the chatgpt.messages.{slug} metric key (see entrypoints/
// background.ts). A recognized family coarsens to that family's own name
// (e.g. "gpt-4o-2024-11-20" -> "gpt-4o", grouping point/dated releases
// together); an unrecognized-but-present string is reported as itself
// (sanitized), not collapsed into a generic bucket — OpenAI's naming isn't
// ours to predict, and a self-describing slug needs no code change to stay
// accurate as they ship new names, unlike a fixed family list that goes
// stale silently. "unknown" is reserved for when there's truly no model
// string to work with (extraction itself failed) — a real name, even an
// unrecognized one, is always more useful than that.
export function modelSlugFromVersion(modelVersion: string | undefined | null): string {
  const raw = (modelVersion ?? "").trim()
  if (!raw) return "unknown"

  const lower = raw.toLowerCase()
  const family = MODEL_FAMILIES.find((f) => lower.includes(f))
  if (family) return family.replace(/\./g, "-")

  return sanitizeSlug(raw) || "unknown"
}

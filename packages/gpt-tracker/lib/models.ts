// WHY: docs/notes/model-family-slugs.md#model-family-slugs — ordered MOST-specific to LEAST-specific because GPT model version strings nest (e.g. "gpt-4o" contains "gpt-4"), unlike Claude's family names.
const MODEL_FAMILIES = ["gpt-5", "gpt-4o", "gpt-4.1", "gpt-4", "o3", "o1", "gpt-3.5"]

// WHY: docs/notes/gpt-model-slug-safety.md#gpt-model-slug-safety — caps the sanitized slug so a garbled or adversarial model field can't blow up the metric key length.
const MAX_RAW_SLUG_LENGTH = 40

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
    .slice(0, MAX_RAW_SLUG_LENGTH)
}

// WHY: docs/notes/model-family-slugs.md#model-family-slugs — an unrecognized model is reported as itself (sanitized), not a generic bucket, since a self-describing slug needs no code change as OpenAI ships new names.
export function modelSlugFromVersion(modelVersion: string | undefined | null): string {
  const raw = (modelVersion ?? "").trim()
  if (!raw) return "unknown"

  const lower = raw.toLowerCase()
  const family = MODEL_FAMILIES.find((f) => lower.includes(f))
  if (family) return family.replace(/\./g, "-")

  return sanitizeSlug(raw) || "unknown"
}

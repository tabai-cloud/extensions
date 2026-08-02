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

// modelSlugFromVersion maps a ChatGPT model version string down to the
// coarse family slug used in the chatgpt.messages.{slug} metric key (see
// entrypoints/background.ts). Falls back to "unknown" for a model version
// this extension doesn't recognize yet, rather than silently dropping the
// message-sent signal entirely — an "unknown" bucket in Convex is a
// visible, debuggable gap; a dropped sample isn't. Dots are replaced with
// dashes so a model slug never collides with the metric key's own
// dot-delimited segments (e.g. "gpt-4.1" -> "gpt-4-1").
export function modelSlugFromVersion(modelVersion: string | undefined | null): string {
  const slug = (modelVersion ?? "").toLowerCase()
  const match = MODEL_FAMILIES.find((family) => slug.includes(family))
  return (match ?? "unknown").replace(/\./g, "-")
}

---
title: GPT model family names nest, unlike Claude's
used_by:
  - packages/gpt-tracker/lib/models.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## Model family slugs <a id="model-family-slugs"></a>

### packages/gpt-tracker/lib/models.ts — MODEL_FAMILIES

Ordered MOST-specific to LEAST-specific and matched in that order —
unlike Claude's family names (which never nest inside one another:
"opus"/"sonnet"/"haiku"/"fable" share no substrings), GPT's model version
strings do nest ("gpt-4o" contains "gpt-4", "gpt-4.1" contains "gpt-4"),
so checking "gpt-4" before "gpt-4o"/"gpt-4.1" would misclassify every
gpt-4o/gpt-4.1 message as plain "gpt-4". This list is a best-effort guess
at OpenAI's current naming, unlike Claude's family list (ported from a
mature, maintained reference extension) — expect to need upkeep as
OpenAI ships new model names.

### packages/gpt-tracker/lib/models.ts — modelSlugFromVersion

Maps a ChatGPT model version string down to the slug used in the
`chatgpt.messages.{slug}` metric key. A recognized family coarsens to
that family's own name (e.g. `"gpt-4o-2024-11-20"` -> `"gpt-4o"`,
grouping point/dated releases together); an unrecognized-but-present
string is reported as itself (sanitized), not collapsed into a generic
bucket — OpenAI's naming isn't ours to predict, and a self-describing
slug needs no code change to stay accurate as they ship new names,
unlike a fixed family list that goes stale silently. `"unknown"` is
reserved for when there's truly no model string to work with (extraction
itself failed) — a real name, even an unrecognized one, is always more
useful than that.

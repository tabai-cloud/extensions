---
title: The sanitized model slug is capped against adversarial input
used_by:
  - packages/gpt-tracker/lib/models.ts
sidebar:
  badge: { text: extensions, variant: note }
---

## GPT model slug safety <a id="gpt-model-slug-safety"></a>

### packages/gpt-tracker/lib/models.ts — MAX_RAW_SLUG_LENGTH

A metric-key-safe slug: lowercase, non `[a-z0-9-]` characters collapsed
to a single dash, no leading/trailing dashes, capped well short of
anything that would make a runaway metric key — a garbled or adversarial
model field shouldn't be able to blow up the key length.

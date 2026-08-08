---
title: "--strip-components=4 matches the tarball's expected top-level prefix"
used_by:
  - scripts/install.sh
sidebar:
  badge: { text: extensions, variant: note }
---

## Tarball --strip-components <a id="tarball-strip-components"></a>

### scripts/install.sh

The tarball's own top-level entry is claimed to be
`"ai-cloud-tracker-<branch>/"`, so a package's prebuilt extension is
claimed to live at
`"ai-cloud-tracker-<branch>/packages/<package>/extension/..."` —
`--strip-components=4` drops that 4-segment prefix
(`ai-cloud-tracker-<branch>` / `packages` / `<package>` / `extension`)
so `manifest.json` lands directly at `$TARGET_DIR/manifest.json`. See
`docs/notes/_UNCLEAR.md` for a doubt about whether the
`"ai-cloud-tracker-<branch>"` prefix is still accurate after this repo's
rename to `tabai-cloud/extensions`.

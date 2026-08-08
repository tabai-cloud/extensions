---
title: used_by is compared per anchor, per DECISIONS.md's Ajuste 2
used_by:
  - check_anchors.py
sidebar:
  badge: { text: extensions, variant: note }
---

## check_anchors.py used_by semantics <a id="check-anchors-used-by-semantics"></a>

### check_anchors.py

Per DECISIONS.md's Ajuste 2: `used_by` needs to match who actually
references the note, not just list paths that happen to exist on disk.
The comparison is done per anchor: if a note had several anchors, the
declared `used_by` would apply to all of them — a deliberate
simplification. (In practice, this project's own "one note = one
anchor" rule means this never actually comes up, but if it ever becomes
a problem, `used_by` could be moved inside each section instead.)

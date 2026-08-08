#!/usr/bin/env python3
"""Valida referencias WHY: no codigo contra ancoras em docs/notes/*.md.

Uso: python check_anchors.py [--root .] [--strict]

Sem --strict: notas orfas (sem nenhuma ref WHY: apontando pra elas) geram
aviso, nao erro. Com --strict: viram erro. Nao ligar --strict antes de um
mes de uso do padrao em producao (ver DECISIONS.md).
"""
import argparse
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("erro: PyYAML nao instalado. pip install pyyaml", file=sys.stderr)
    sys.exit(2)

WHY_RE = re.compile(r"WHY:\s*(docs/notes/[^\s#]+\.md)#([A-Za-z0-9_-]+)")
ANCHOR_RE = re.compile(r'<a\s+id=["\']([A-Za-z0-9_-]+)["\']\s*(?:/>|>\s*</a>)', re.IGNORECASE)
BRACE_ANCHOR_RE = re.compile(r"\{#([A-Za-z0-9_-]+)\}")

EXCLUDE_DIRS = {".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__"}


def iter_source_files(root):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
        rel = path.relative_to(root).as_posix()
        if rel.startswith("docs/notes/"):
            continue  # notas nao carregam refs WHY: sobre si mesmas
        yield path, rel


def collect_refs(root):
    """retorna lista de (src_relpath, line_no, doc_relpath, anchor)."""
    refs = []
    for path, rel in iter_source_files(root):
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for line_no, line in enumerate(text.splitlines(), start=1):
            m = WHY_RE.search(line)
            if m:
                refs.append((rel, line_no, m.group(1), m.group(2)))
    return refs


def parse_frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    _, fm_text, body = parts
    try:
        fm = yaml.safe_load(fm_text) or {}
    except yaml.YAMLError as e:
        raise ValueError(f"frontmatter invalido: {e}")
    return fm, body


def collect_notes(root):
    """retorna dict doc_relpath -> {"anchors": set, "used_by": list, "errors": [...]}"""
    notes = {}
    notes_dir = root / "docs" / "notes"
    if not notes_dir.is_dir():
        return notes
    for path in sorted(notes_dir.glob("*.md")):
        if path.name.startswith("_"):
            continue  # _INVENTORY.md, _UNCLEAR.md etc nao sao notas
        rel = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8", errors="ignore")
        entry = {"anchors": set(), "used_by": [], "errors": []}
        try:
            fm, body = parse_frontmatter(text)
        except ValueError as e:
            entry["errors"].append(f"{rel}:1: {e}")
            notes[rel] = entry
            continue

        used_by = fm.get("used_by")
        if not used_by or not isinstance(used_by, list):
            entry["errors"].append(f"{rel}:1: frontmatter sem 'used_by' (lista obrigatoria e nao vazia)")
        else:
            entry["used_by"] = [str(p) for p in used_by]

        if not fm.get("title"):
            entry["errors"].append(f"{rel}:1: frontmatter sem 'title'")

        for m in BRACE_ANCHOR_RE.finditer(body):
            entry["errors"].append(
                f"{rel}:1: ancora '{{#{m.group(1)}}}' encontrada - use <a id=\"{m.group(1)}\"></a> em vez disso"
            )

        for m in ANCHOR_RE.finditer(body):
            entry["anchors"].add(m.group(1))

        if len(entry["anchors"]) > 1:
            entry["errors"].append(
                f"{rel}:1: nota tem {len(entry['anchors'])} ancoras ({', '.join(sorted(entry['anchors']))}) - "
                "convencao do projeto e uma nota = um topico = uma ancora, porque used_by e por nota inteira, "
                "nao por ancora (used_by nao consegue expressar 'este arquivo usa so a ancora X'). "
                "Separe em notas distintas."
            )

        notes[rel] = entry
    return notes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="raiz do repo (default: diretorio atual)")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="tambem falha em notas orfas. Desligado por padrao (ver DECISIONS.md).",
    )
    args = parser.parse_args()
    root = Path(args.root).resolve()

    refs = collect_refs(root)
    notes = collect_notes(root)
    errors = []

    for entry in notes.values():
        errors.extend(entry["errors"])

    referrers = {}  # (doc, anchor) -> set(src relpaths que de fato referenciam)
    for src, line_no, doc, anchor in refs:
        referrers.setdefault((doc, anchor), set()).add(src)
        note = notes.get(doc)
        if note is None:
            errors.append(f"{src}:{line_no}: WHY aponta para nota inexistente '{doc}'")
            continue
        if anchor not in note["anchors"]:
            errors.append(
                f"{src}:{line_no}: WHY aponta para '{doc}#{anchor}', mas essa ancora nao existe na nota"
            )

    # WHY: docs/notes/check-anchors-used-by-semantics.md#check-anchors-used-by-semantics — used_by e comparado por ancora, nao so por existencia de caminho no disco (Ajuste 2 do DECISIONS.md).
    declared_used_by = {}  # (doc, anchor) -> lista declarada no frontmatter
    for doc, entry in notes.items():
        for anchor in entry["anchors"]:
            declared_used_by[(doc, anchor)] = entry["used_by"]

    for (doc, anchor), declared in declared_used_by.items():
        actual = referrers.get((doc, anchor), set())
        for missing in sorted(actual - set(declared)):
            errors.append(f"{doc}:1: {missing} referencia #{anchor} mas nao esta em used_by")
        for stale in sorted(set(declared) - actual):
            if (root / stale).is_file():
                errors.append(f"{doc}:1: used_by lista {stale}, mas ele nao referencia #{anchor}")

    orphan_warnings = []
    for doc, entry in notes.items():
        if not entry["anchors"]:
            continue
        if not any((doc, a) in referrers for a in entry["anchors"]):
            orphan_warnings.append(f"{doc}:1: nota sem nenhuma ref WHY: apontando para ela (orfa)")

    if orphan_warnings:
        label = "erro" if args.strict else "aviso"
        for w in orphan_warnings:
            print(f"{label}: {w}")
        if args.strict:
            errors.extend(orphan_warnings)

    if errors:
        print(f"\n{len(errors)} erro(s):")
        for e in errors:
            print(f"  {e}")
        print(f"\n{len(refs)} ref(s) WHY: encontradas, {len(notes)} nota(s) em docs/notes/.")
        sys.exit(1)

    print(f"ok: {len(refs)} ref(s) WHY:, {len(notes)} nota(s) em docs/notes/, 0 erro(s).")
    sys.exit(0)


if __name__ == "__main__":
    main()

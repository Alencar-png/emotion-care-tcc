"""Extrai itens hierárquicos (X.Y.Z[.W]) dos textos integrais das normas
para enriquecer regulatory_lookup.NR01_ITEMS e NR17_ITEMS, eliminando
falsos positivos de alucinação ao validar citações detalhadas.

Imprime no stdout dois dicts Python prontos para colar no arquivo
regulatory_lookup.py.
"""
from __future__ import annotations
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NORMAS = ROOT.parent / "normas_completas"

ITEM_PAT = re.compile(r"(?m)^\s*(\d+(?:\.\d+){1,5})\b\s+([A-ZÁ-ÚÀ-Üa-zá-úà-ü][^\n]{2,140})")


def harvest(text: str, prefix: str) -> dict[str, str]:
    """Extrai itens de 'X.Y' até 'X.Y.Z.W.V.U' começando por prefix."""
    out: dict[str, str] = {}
    for m in ITEM_PAT.finditer(text):
        loc = m.group(1)
        desc = m.group(2).strip()
        if not loc.startswith(prefix):
            continue
        # Restringe a descrição a 80 chars para manter compacto
        desc = re.sub(r"\s+", " ", desc)[:90]
        if loc not in out:
            out[loc] = desc
    return out


def main():
    nr01 = (NORMAS / "nr01.txt").read_text(encoding="utf-8")
    nr17 = (NORMAS / "nr17.txt").read_text(encoding="utf-8")

    items01 = harvest(nr01, "1.")
    items17 = harvest(nr17, "17.")

    print(f"# NR-01: {len(items01)} itens detectados")
    print("NR01_EXTRA_ITEMS = {")
    for k in sorted(items01.keys(), key=lambda s: [int(x) for x in s.split(".")]):
        v = items01[k].replace('"', "'")
        print(f'    "{k}": "{v}",')
    print("}")
    print()
    print(f"# NR-17: {len(items17)} itens detectados")
    print("NR17_EXTRA_ITEMS = {")
    for k in sorted(items17.keys(), key=lambda s: [int(x) for x in s.split(".")]):
        v = items17[k].replace('"', "'")
        print(f'    "{k}": "{v}",')
    print("}")


if __name__ == "__main__":
    main()

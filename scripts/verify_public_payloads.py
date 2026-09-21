#!/usr/bin/env python3
"""Block clinical annotation payloads from the public GitHub Pages artifact."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MAP = PUBLIC / "snomed-concepts-data.json"
FORBIDDEN_FILES = {"snomed-context-data.local.json"}
FORBIDDEN_KEYS = {
    "caseId", "caseIds", "cases", "annotatorId", "annotatorIds", "annotators",
    "surfaces", "textoLiteral", "textNorm", "before", "mention", "after",
    "sourceFile", "annotationSource", "embeddingSource", "metadataSource", "hierarchySource",
}


def find_forbidden(value: object, path: str = "$") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key in FORBIDDEN_KEYS:
                found.append(child_path)
            found.extend(find_forbidden(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            found.extend(find_forbidden(child, f"{path}[{index}]"))
    return found


def main() -> int:
    errors: list[str] = []
    if not MAP.is_file():
        errors.append("Falta public/snomed-concepts-data.json")
    else:
        try:
            payload = json.loads(MAP.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"El mapa SNOMED no es JSON válido: {exc}")
        else:
            forbidden = find_forbidden(payload)
            if forbidden:
                errors.append("El mapa contiene campos sensibles: " + ", ".join(forbidden[:5]))
            policy = payload.get("source", {}).get("publicDataPolicy", {})
            for key in ("clinicalTextIncluded", "caseIdentifiersIncluded", "annotatorIdentifiersIncluded", "sourcePathsIncluded"):
                if policy.get(key) is not False:
                    errors.append(f"El mapa no declara {key}=false")
    for path in PUBLIC.rglob("*"):
        if path.is_file() and path.name in FORBIDDEN_FILES:
            errors.append(f"No se puede publicar {path.relative_to(ROOT)}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print("OK: el payload público sólo contiene conceptos y métricas agregadas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

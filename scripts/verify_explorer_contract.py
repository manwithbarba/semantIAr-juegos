#!/usr/bin/env python3
"""Validate the public SNOMED explorer payload using only the standard library."""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PAYLOAD = ROOT / "public" / "snomed-concepts-data.json"

EXPECTED_CATEGORIES = {"Hallazgo clínico", "Procedimiento", "Fármaco"}
POLICY_FIELDS = {
    "clinicalTextIncluded",
    "caseIdentifiersIncluded",
    "annotatorIdentifiersIncluded",
    "sourcePathsIncluded",
}
METHODOLOGY_FIELDS = {
    "snomedEdition",
    "snomedReleaseDate",
    "representationModel",
    "representationDimension",
    "representationInput",
    "similarityMetric",
    "neighborScope",
    "neighborsPerConcept",
    "pcaExplainedVariance2D",
    "tsnePerplexity",
    "tsneMetric",
    "tsneInitialization",
    "tsneLearningRate",
    "tsneIterations",
    "randomSeed",
}
SOURCE_FIELDS = {
    "editionLabel",
    "embeddingDimension",
    "generatedAt",
    "annotatedSctidCount",
    "embeddedSctidCount",
    "missingSctidCount",
    "annotatedCaseCount",
    "annotatorCount",
    "annotationAssignmentCount",
    "annotatedOccurrenceCount",
    "hierarchyEdgeCount",
    "hierarchyLinkedConceptCount",
    "methodology",
    "publicDataPolicy",
}
POINT_FIELDS = {
    "sctid",
    "term",
    "semanticTag",
    "occurrences",
    "caseCount",
    "annotatorCount",
    "categories",
    "polarities",
    "temporalities",
    "subjects",
    "parents",
    "children",
    "pca",
    "tsne",
    "neighbors",
}

# Normalized below so case, separators, and common naming variants cannot bypass it.
SENSITIVE_KEYS = {
    "case",
    "caseId",
    "caseIds",
    "cases",
    "annotator",
    "annotatorId",
    "annotatorIds",
    "annotators",
    "surfaces",
    "textoLiteral",
    "textNorm",
    "clinicalText",
    "clinicalTexts",
    "noteText",
    "noteTexts",
    "rawText",
    "rawTexts",
    "before",
    "mention",
    "after",
    "context",
    "contexts",
    "snippet",
    "snippets",
    "files",
    "filePath",
    "filePaths",
    "sourceFile",
    "sourcePath",
    "sourcePaths",
    "annotationSource",
    "embeddingSource",
    "metadataSource",
    "hierarchySource",
}


def normalized_key(value: str) -> str:
    return "".join(character for character in value.casefold() if character.isalnum())


NORMALIZED_SENSITIVE_KEYS = {normalized_key(key) for key in SENSITIVE_KEYS}


class DuplicateKeyError(ValueError):
    """Raised when a JSON object contains an ambiguous duplicate key."""


class Problems:
    """Collect useful diagnostics without flooding CI output."""

    def __init__(self, limit: int = 100) -> None:
        self.messages: list[str] = []
        self.total = 0
        self.limit = limit

    def add(self, message: str) -> None:
        self.total += 1
        if len(self.messages) < self.limit:
            self.messages.append(message)

    def report(self) -> int:
        if not self.total:
            return 0
        for message in self.messages:
            print(f"ERROR: {message}", file=sys.stderr)
        if self.total > len(self.messages):
            omitted = self.total - len(self.messages)
            print(f"ERROR: se omitieron {omitted} errores adicionales.", file=sys.stderr)
        print(f"FALLO: se encontraron {self.total} errores de contrato.", file=sys.stderr)
        return 1


def reject_duplicate_keys(pairs: Iterable[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError(f"clave JSON duplicada: {key!r}")
        result[key] = value
    return result


def reject_nonstandard_number(value: str) -> None:
    raise ValueError(f"número JSON no estándar: {value}")


def is_integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def is_number(value: Any) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return not isinstance(value, float) or math.isfinite(value)


def is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def require_fields(
    value: dict[str, Any], required: set[str], path: str, problems: Problems
) -> None:
    missing = sorted(required - value.keys())
    if missing:
        problems.add(f"{path} no contiene los campos requeridos: {', '.join(missing)}")


def require_nonnegative_integer(
    value: Any, path: str, problems: Problems
) -> int | None:
    if not is_integer(value) or value < 0:
        problems.add(f"{path} debe ser un entero no negativo")
        return None
    return value


def require_positive_integer(value: Any, path: str, problems: Problems) -> int | None:
    if not is_integer(value) or value <= 0:
        problems.add(f"{path} debe ser un entero positivo")
        return None
    return value


def find_sensitive_keys(value: Any, problems: Problems, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if normalized_key(key) in NORMALIZED_SENSITIVE_KEYS:
                problems.add(f"clave sensible prohibida en {child_path}")
            find_sensitive_keys(child, problems, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            find_sensitive_keys(child, problems, f"{path}[{index}]")


def validate_generated_at(value: Any, problems: Problems) -> None:
    if not is_nonempty_string(value):
        problems.add("$.source.generatedAt debe ser una fecha ISO 8601 no vacía")
        return
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        problems.add("$.source.generatedAt no es una fecha ISO 8601 válida")


def validate_methodology(
    value: Any, source: dict[str, Any], point_count: int, problems: Problems
) -> int | None:
    path = "$.source.methodology"
    if not isinstance(value, dict):
        problems.add(f"{path} debe ser un objeto")
        return None
    require_fields(value, METHODOLOGY_FIELDS, path, problems)

    string_fields = {
        "snomedEdition",
        "snomedReleaseDate",
        "representationModel",
        "representationInput",
        "similarityMetric",
        "neighborScope",
        "tsneMetric",
        "tsneInitialization",
    }
    for field in sorted(string_fields):
        if field in value and not is_nonempty_string(value[field]):
            problems.add(f"{path}.{field} debe ser un texto no vacío")

    dimension = None
    if "representationDimension" in value:
        dimension = require_positive_integer(
            value["representationDimension"],
            f"{path}.representationDimension",
            problems,
        )
    embedding_dimension = source.get("embeddingDimension")
    if dimension is not None and is_integer(embedding_dimension):
        if dimension != embedding_dimension:
            problems.add(
                f"{path}.representationDimension ({dimension}) no coincide con "
                f"$.source.embeddingDimension ({embedding_dimension})"
            )

    neighbors_per_concept = None
    if "neighborsPerConcept" in value:
        neighbors_per_concept = require_nonnegative_integer(
            value["neighborsPerConcept"],
            f"{path}.neighborsPerConcept",
            problems,
        )
        if (
            neighbors_per_concept is not None
            and neighbors_per_concept > max(0, point_count - 1)
        ):
            problems.add(
                f"{path}.neighborsPerConcept no puede superar points.length - 1"
            )

    explained_variance = value.get("pcaExplainedVariance2D")
    if "pcaExplainedVariance2D" in value:
        if not is_number(explained_variance) or not 0 <= explained_variance <= 1:
            problems.add(
                f"{path}.pcaExplainedVariance2D debe ser numérico, finito y estar entre 0 y 1"
            )

    perplexity = value.get("tsnePerplexity")
    if "tsnePerplexity" in value:
        if not is_number(perplexity) or perplexity <= 0:
            problems.add(f"{path}.tsnePerplexity debe ser numérico, finito y positivo")
        elif point_count and perplexity >= point_count:
            problems.add(f"{path}.tsnePerplexity debe ser menor que points.length")

    learning_rate = value.get("tsneLearningRate")
    if "tsneLearningRate" in value and not (
        is_nonempty_string(learning_rate)
        or (is_number(learning_rate) and learning_rate > 0)
    ):
        problems.add(
            f"{path}.tsneLearningRate debe ser un texto no vacío o un número finito positivo"
        )

    if "tsneIterations" in value:
        require_positive_integer(value["tsneIterations"], f"{path}.tsneIterations", problems)
    if "randomSeed" in value and not is_integer(value["randomSeed"]):
        problems.add(f"{path}.randomSeed debe ser un entero")

    return neighbors_per_concept


def validate_count_map(
    value: Any, path: str, problems: Problems
) -> tuple[int, set[str]] | None:
    if not isinstance(value, dict):
        problems.add(f"{path} debe ser un objeto de conteos")
        return None
    total = 0
    labels: set[str] = set()
    for label, count in value.items():
        if not is_nonempty_string(label):
            problems.add(f"{path} contiene una etiqueta vacía")
        else:
            labels.add(label)
        if not is_integer(count) or count <= 0:
            problems.add(f"{path}.{label} debe ser un entero positivo")
        else:
            total += count
    return total, labels


def validate_coordinates(value: Any, path: str, problems: Problems) -> None:
    if not isinstance(value, list) or len(value) != 2:
        problems.add(f"{path} debe ser un arreglo de dos coordenadas")
        return
    for index, coordinate in enumerate(value):
        if not is_number(coordinate):
            problems.add(f"{path}[{index}] debe ser numérica y finita")


def validate_relation_list(
    value: Any,
    path: str,
    point_id: str,
    relation_kind: str,
    point_ids: set[str],
    problems: Problems,
) -> tuple[set[tuple[str, str]], bool]:
    expected_edges: set[tuple[str, str]] = set()
    has_relations = False
    if not isinstance(value, list):
        problems.add(f"{path} debe ser un arreglo")
        return expected_edges, has_relations
    has_relations = bool(value)
    seen: set[str] = set()
    for index, relation in enumerate(value):
        relation_path = f"{path}[{index}]"
        if not isinstance(relation, dict):
            problems.add(f"{relation_path} debe ser un objeto")
            continue
        require_fields(relation, {"sctid", "term", "onMap"}, relation_path, problems)
        related_id = relation.get("sctid")
        if not is_nonempty_string(related_id) or not related_id.isdigit():
            problems.add(f"{relation_path}.sctid debe ser un SCTID numérico no vacío")
            continue
        if related_id in seen:
            problems.add(f"{path} repite el SCTID {related_id}")
        seen.add(related_id)
        if not is_nonempty_string(relation.get("term")):
            problems.add(f"{relation_path}.term debe ser un texto no vacío")
        on_map = relation.get("onMap")
        if not isinstance(on_map, bool):
            problems.add(f"{relation_path}.onMap debe ser booleano")
        elif on_map:
            if related_id not in point_ids:
                problems.add(
                    f"{relation_path} declara onMap=true pero {related_id} no existe en points"
                )
            edge = (
                (point_id, related_id)
                if relation_kind == "parents"
                else (related_id, point_id)
            )
            expected_edges.add(edge)
    return expected_edges, has_relations


def validate_neighbors(
    value: Any,
    path: str,
    point_id: str,
    point_ids: set[str],
    expected_count: int | None,
    problems: Problems,
) -> None:
    if not isinstance(value, list):
        problems.add(f"{path} debe ser un arreglo")
        return
    if expected_count is not None and len(value) != expected_count:
        problems.add(
            f"{path} contiene {len(value)} vecinos; methodology.neighborsPerConcept "
            f"declara {expected_count}"
        )
    seen: set[str] = set()
    for index, neighbor in enumerate(value):
        neighbor_path = f"{path}[{index}]"
        if not isinstance(neighbor, dict):
            problems.add(f"{neighbor_path} debe ser un objeto")
            continue
        require_fields(neighbor, {"sctid", "term", "similarity"}, neighbor_path, problems)
        neighbor_id = neighbor.get("sctid")
        if not is_nonempty_string(neighbor_id) or not neighbor_id.isdigit():
            problems.add(f"{neighbor_path}.sctid debe ser un SCTID numérico no vacío")
        else:
            if neighbor_id == point_id:
                problems.add(f"{neighbor_path} no puede referenciar al propio punto")
            if neighbor_id not in point_ids:
                problems.add(
                    f"{neighbor_path}.sctid referencia {neighbor_id}, que no existe en points"
                )
            if neighbor_id in seen:
                problems.add(f"{path} repite el vecino {neighbor_id}")
            seen.add(neighbor_id)
        if not is_nonempty_string(neighbor.get("term")):
            problems.add(f"{neighbor_path}.term debe ser un texto no vacío")
        similarity = neighbor.get("similarity")
        if not is_number(similarity):
            problems.add(f"{neighbor_path}.similarity debe ser numérica y finita")
        elif not -1 <= similarity <= 1:
            problems.add(f"{neighbor_path}.similarity debe estar entre -1 y 1")


def validate_hierarchy_edges(
    value: Any, point_ids: set[str], problems: Problems
) -> set[tuple[str, str]]:
    valid_edges: set[tuple[str, str]] = set()
    if not isinstance(value, list):
        problems.add("$.hierarchyEdges debe ser un arreglo")
        return valid_edges
    for index, edge in enumerate(value):
        path = f"$.hierarchyEdges[{index}]"
        if not isinstance(edge, dict):
            problems.add(f"{path} debe ser un objeto")
            continue
        require_fields(edge, {"source", "target"}, path, problems)
        source = edge.get("source")
        target = edge.get("target")
        if not is_nonempty_string(source) or not source.isdigit():
            problems.add(f"{path}.source debe ser un SCTID numérico no vacío")
        if not is_nonempty_string(target) or not target.isdigit():
            problems.add(f"{path}.target debe ser un SCTID numérico no vacío")
        if not (is_nonempty_string(source) and is_nonempty_string(target)):
            continue
        if source not in point_ids:
            problems.add(f"{path}.source referencia {source}, que no existe en points")
        if target not in point_ids:
            problems.add(f"{path}.target referencia {target}, que no existe en points")
        if source == target:
            problems.add(f"{path} no puede ser una autorrelación")
        pair = (source, target)
        if pair in valid_edges:
            problems.add(f"{path} duplica la arista {source} -> {target}")
        valid_edges.add(pair)
    return valid_edges


def validate_payload(payload: Any, problems: Problems) -> tuple[int, int]:
    if not isinstance(payload, dict):
        problems.add("$ debe ser un objeto JSON")
        return 0, 0
    require_fields(payload, {"source", "hierarchyEdges", "points"}, "$", problems)
    find_sensitive_keys(payload, problems)

    source = payload.get("source")
    points = payload.get("points")
    hierarchy_edges = payload.get("hierarchyEdges")
    if not isinstance(source, dict):
        problems.add("$.source debe ser un objeto")
        source = {}
    else:
        require_fields(source, SOURCE_FIELDS, "$.source", problems)
    if not isinstance(points, list):
        problems.add("$.points debe ser un arreglo")
        points = []
    elif not points:
        problems.add("$.points no puede estar vacío")
    if not isinstance(hierarchy_edges, list):
        problems.add("$.hierarchyEdges debe ser un arreglo")
        hierarchy_edges = []

    if "editionLabel" in source and not is_nonempty_string(source["editionLabel"]):
        problems.add("$.source.editionLabel debe ser un texto no vacío")
    if "embeddingDimension" in source:
        require_positive_integer(
            source["embeddingDimension"], "$.source.embeddingDimension", problems
        )
    if "generatedAt" in source:
        validate_generated_at(source["generatedAt"], problems)

    count_fields = {
        field: require_nonnegative_integer(source[field], f"$.source.{field}", problems)
        for field in (
            "annotatedSctidCount",
            "embeddedSctidCount",
            "missingSctidCount",
            "annotatedCaseCount",
            "annotatorCount",
            "annotationAssignmentCount",
            "annotatedOccurrenceCount",
            "hierarchyEdgeCount",
            "hierarchyLinkedConceptCount",
        )
        if field in source
    }

    expected_neighbors = None
    if "methodology" in source:
        expected_neighbors = validate_methodology(
            source["methodology"], source, len(points), problems
        )
    policy = source.get("publicDataPolicy")
    if "publicDataPolicy" not in source:
        pass
    elif not isinstance(policy, dict):
        problems.add("$.source.publicDataPolicy debe ser un objeto")
    else:
        require_fields(policy, POLICY_FIELDS, "$.source.publicDataPolicy", problems)
        for key, value in policy.items():
            if value is not False:
                problems.add(f"$.source.publicDataPolicy.{key} debe ser false")

    point_ids: set[str] = set()
    for index, point in enumerate(points):
        path = f"$.points[{index}]"
        if not isinstance(point, dict):
            problems.add(f"{path} debe ser un objeto")
            continue
        require_fields(point, POINT_FIELDS, path, problems)
        sctid = point.get("sctid")
        if not is_nonempty_string(sctid) or not sctid.isdigit():
            problems.add(f"{path}.sctid debe ser un SCTID numérico no vacío")
            continue
        if sctid in point_ids:
            problems.add(f"{path}.sctid duplica el SCTID {sctid}")
        point_ids.add(sctid)

    all_categories: set[str] = set()
    visible_occurrences = 0
    maximum_case_count = 0
    maximum_annotator_count = 0
    hierarchy_linked_ids: set[str] = set()
    relation_edges: set[tuple[str, str]] = set()
    for index, point in enumerate(points):
        path = f"$.points[{index}]"
        if not isinstance(point, dict):
            continue
        sctid = point.get("sctid")
        if not (is_nonempty_string(sctid) and sctid.isdigit()):
            continue
        if not is_nonempty_string(point.get("term")):
            problems.add(f"{path}.term debe ser un texto no vacío")
        if not is_nonempty_string(point.get("semanticTag")):
            problems.add(f"{path}.semanticTag debe ser un texto no vacío")

        occurrences = None
        if "occurrences" in point:
            occurrences = require_positive_integer(
                point["occurrences"], f"{path}.occurrences", problems
            )
            if occurrences is not None:
                visible_occurrences += occurrences
        case_count = None
        if "caseCount" in point:
            case_count = require_positive_integer(
                point["caseCount"], f"{path}.caseCount", problems
            )
            if case_count is not None:
                maximum_case_count = max(maximum_case_count, case_count)
        annotator_count = None
        if "annotatorCount" in point:
            annotator_count = require_positive_integer(
                point["annotatorCount"], f"{path}.annotatorCount", problems
            )
            if annotator_count is not None:
                maximum_annotator_count = max(maximum_annotator_count, annotator_count)
        if occurrences is not None and case_count is not None and case_count > occurrences:
            problems.add(f"{path}.caseCount no puede superar occurrences")
        if (
            occurrences is not None
            and annotator_count is not None
            and annotator_count > occurrences
        ):
            problems.add(f"{path}.annotatorCount no puede superar occurrences")

        for field in ("categories", "polarities", "temporalities", "subjects"):
            result = validate_count_map(point.get(field), f"{path}.{field}", problems)
            if result is None:
                continue
            total, labels = result
            if field == "categories":
                all_categories.update(labels)
                if labels and occurrences is not None and total != occurrences:
                    problems.add(
                        f"{path}.categories suma {total}, pero occurrences vale {occurrences}"
                    )
            elif occurrences is not None and total > occurrences:
                problems.add(f"{path}.{field} suma más que occurrences")

        validate_coordinates(point.get("pca"), f"{path}.pca", problems)
        validate_coordinates(point.get("tsne"), f"{path}.tsne", problems)
        validate_neighbors(
            point.get("neighbors"),
            f"{path}.neighbors",
            sctid,
            point_ids,
            expected_neighbors,
            problems,
        )
        for relation_kind in ("parents", "children"):
            edges, has_relations = validate_relation_list(
                point.get(relation_kind),
                f"{path}.{relation_kind}",
                sctid,
                relation_kind,
                point_ids,
                problems,
            )
            relation_edges.update(edges)
            if has_relations:
                hierarchy_linked_ids.add(sctid)

    if all_categories and all_categories != EXPECTED_CATEGORIES:
        missing = sorted(EXPECTED_CATEGORIES - all_categories)
        unexpected = sorted(all_categories - EXPECTED_CATEGORIES)
        details = []
        if missing:
            details.append("faltan: " + ", ".join(missing))
        if unexpected:
            details.append("no esperadas: " + ", ".join(unexpected))
        problems.add(
            "las categorías principales deben ser exactamente "
            + ", ".join(sorted(EXPECTED_CATEGORIES))
            + " ("
            + "; ".join(details)
            + ")"
        )

    edge_set = validate_hierarchy_edges(hierarchy_edges, point_ids, problems)
    for edge in sorted(relation_edges - edge_set):
        problems.add(
            f"la relación onMap {edge[0]} -> {edge[1]} no aparece en $.hierarchyEdges"
        )
    for edge in sorted(edge_set - relation_edges):
        problems.add(
            f"la arista {edge[0]} -> {edge[1]} no está reflejada en parents/children con onMap=true"
        )

    embedded = count_fields.get("embeddedSctidCount")
    annotated = count_fields.get("annotatedSctidCount")
    missing = count_fields.get("missingSctidCount")
    occurrences = count_fields.get("annotatedOccurrenceCount")
    cases = count_fields.get("annotatedCaseCount")
    annotators = count_fields.get("annotatorCount")
    assignments = count_fields.get("annotationAssignmentCount")
    hierarchy_count = count_fields.get("hierarchyEdgeCount")
    linked_count = count_fields.get("hierarchyLinkedConceptCount")

    if embedded is not None and embedded != len(points):
        problems.add(
            f"$.source.embeddedSctidCount ({embedded}) no coincide con points.length ({len(points)})"
        )
    if annotated is not None and embedded is not None and missing is not None:
        if annotated != embedded + missing:
            problems.add(
                "$.source.annotatedSctidCount debe ser embeddedSctidCount + missingSctidCount"
            )
    if occurrences is not None and annotated is not None and occurrences < annotated:
        problems.add(
            "$.source.annotatedOccurrenceCount no puede ser menor que annotatedSctidCount"
        )
    if occurrences is not None and missing is not None:
        minimum_occurrences = visible_occurrences + missing
        if occurrences < minimum_occurrences:
            problems.add(
                f"$.source.annotatedOccurrenceCount ({occurrences}) debe cubrir las "
                f"{visible_occurrences} apariciones embebidas y al menos una por cada SCTID faltante"
            )
        if missing == 0 and occurrences != visible_occurrences:
            problems.add(
                "sin SCTID faltantes, annotatedOccurrenceCount debe coincidir con la suma de points[].occurrences"
            )
    if cases is not None and cases < maximum_case_count:
        problems.add("$.source.annotatedCaseCount es menor que un points[].caseCount")
    if annotators is not None and annotators < maximum_annotator_count:
        problems.add("$.source.annotatorCount es menor que un points[].annotatorCount")
    if cases is not None and annotators is not None and assignments is not None:
        if (cases == 0 or annotators == 0) and assignments != 0:
            problems.add(
                "$.source.annotationAssignmentCount debe ser 0 si no hay casos o anotadores"
            )
        if cases > 0 and annotators > 0:
            if assignments < max(cases, annotators):
                problems.add(
                    "$.source.annotationAssignmentCount es menor que los casos o anotadores distintos"
                )
            if assignments > cases * annotators:
                problems.add(
                    "$.source.annotationAssignmentCount supera el máximo de pares caso–anotador"
                )
    if hierarchy_count is not None and hierarchy_count != len(hierarchy_edges):
        problems.add(
            f"$.source.hierarchyEdgeCount ({hierarchy_count}) no coincide con "
            f"hierarchyEdges.length ({len(hierarchy_edges)})"
        )
    if linked_count is not None and linked_count != len(hierarchy_linked_ids):
        problems.add(
            f"$.source.hierarchyLinkedConceptCount ({linked_count}) no coincide con los "
            f"{len(hierarchy_linked_ids)} puntos con parents o children"
        )

    return len(points), len(hierarchy_edges)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verifica el contrato del payload público del explorador SNOMED."
    )
    parser.add_argument(
        "payload",
        nargs="?",
        type=Path,
        default=DEFAULT_PAYLOAD,
        help="JSON a verificar (por defecto: public/snomed-concepts-data.json)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_arguments()
    path: Path = args.payload
    problems = Problems()
    try:
        raw = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        print(f"ERROR: no se pudo leer {path}: {error}", file=sys.stderr)
        return 1
    try:
        payload = json.loads(
            raw,
            object_pairs_hook=reject_duplicate_keys,
            parse_constant=reject_nonstandard_number,
        )
    except (json.JSONDecodeError, DuplicateKeyError, ValueError) as error:
        print(f"ERROR: {path} no es JSON válido: {error}", file=sys.stderr)
        return 1

    point_count, edge_count = validate_payload(payload, problems)
    if problems.report():
        return 1
    print(
        "OK: contrato del explorador válido "
        f"({point_count} puntos, {edge_count} aristas jerárquicas, sin datos sensibles)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

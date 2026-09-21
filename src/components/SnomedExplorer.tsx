"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./SnomedExplorer.module.css";

type Counts = Record<string, number>;
type Projection = "pca" | "tsne";
type ColorMode = "category" | "tag" | "frequency" | "annotators";

type Relation = { sctid: string; term: string; onMap: boolean };
type Neighbor = { sctid: string; term: string; similarity: number };
type Point = {
  sctid: string;
  term: string;
  semanticTag: string;
  occurrences: number;
  caseCount: number;
  annotatorCount: number;
  categories: Counts;
  polarities: Counts;
  temporalities: Counts;
  subjects: Counts;
  parents: Relation[];
  children: Relation[];
  pca: [number, number];
  tsne: [number, number];
  neighbors: Neighbor[];
};
type Payload = {
  source: {
    editionLabel: string;
    generatedAt: string;
    annotatedSctidCount: number;
    embeddedSctidCount: number;
    missingSctidCount: number;
    annotatedCaseCount: number;
    annotatorCount: number;
    annotatedOccurrenceCount: number;
    hierarchyEdgeCount: number;
    publicDataPolicy: {
      clinicalTextIncluded: boolean;
      caseIdentifiersIncluded: boolean;
      annotatorIdentifiersIncluded: boolean;
      sourcePathsIncluded: boolean;
    };
  };
  hierarchyEdges: { source: string; target: string }[];
  points: Point[];
};

type PositionedPoint = Point & { x: number; y: number; color: string; colorLabel: string };

const palette = ["#168f82", "#d97736", "#6e62d7", "#c65378", "#287db3", "#7b9d3c", "#d39b29"];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function colorFor(label: string) {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) hash = (hash * 31 + label.charCodeAt(index)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function entries(values: Counts) {
  return Object.entries(values).sort((left, right) => right[1] - left[1]);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "es"));
}

function colorLabelFor(point: Point, colorMode: ColorMode) {
  if (colorMode === "tag") return point.semanticTag || "Sin etiqueta";
  if (colorMode === "frequency") return point.occurrences >= 5 ? "5 o más apariciones" : point.occurrences >= 2 ? "2–4 apariciones" : "1 aparición";
  if (colorMode === "annotators") return point.annotatorCount === 1 ? "1 anotador" : `${point.annotatorCount} anotadores`;
  return entries(point.categories)[0]?.[0] ?? "Sin categoría";
}
export default function SnomedExplorer() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [projection, setProjection] = useState<Projection>("pca");
  const [colorMode, setColorMode] = useState<ColorMode>("category");
  const [category, setCategory] = useState("all");
  const [polarity, setPolarity] = useState("all");
  const [temporality, setTemporality] = useState("all");
  const [subject, setSubject] = useState("all");
  const [showHierarchy, setShowHierarchy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState("");
  const [zoom, setZoom] = useState(1);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  useEffect(() => {
    fetch(`${basePath}/snomed-concepts-data.json`)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el mapa público.");
        return response.json() as Promise<Payload>;
      })
      .then(setPayload)
      .catch(() => setError("No se pudo cargar el conjunto público de conceptos SNOMED."));
  }, [basePath]);

  const records = useMemo(() => payload?.points ?? [], [payload]);
  const source = payload?.source;
  const projectionLabel = projection === "pca" ? "Vista general de los conceptos anotados" : "Conceptos parecidos entre sí";
  const projectionDescription = projection === "pca"
    ? "Agrupa visualmente los conceptos según el parecido entre sus términos y descripciones en SNOMED CT para reconocer tendencias generales del conjunto."
    : "Acerca conceptos con términos y descripciones parecidos en SNOMED CT para explorar similitudes terminológicas entre conceptos anotados.";


  const coordinateMap = useMemo(() => {
    if (!records.length) return new Map<string, { x: number; y: number }>();
    const values = records.map((point) => (projection === "pca" ? point.pca : point.tsne));
    const xValues = values.map((value) => value[0]);
    const yValues = values.map((value) => value[1]);
    const ratio = (value: number, minimum: number, maximum: number) => minimum === maximum ? 0.5 : Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)));
    return new Map(records.map((point, index) => {
      const value = values[index];
      return [point.sctid, { x: 78 + ratio(value[0], Math.min(...xValues), Math.max(...xValues)) * 844, y: 56 + (1 - ratio(value[1], Math.min(...yValues), Math.max(...yValues))) * 508 }];
    }));
  }, [projection, records]);

  const visibleRecords = useMemo(() => {
    const normalizedQuery = normalize(query);
    return records.filter((point) => {
      if (normalizedQuery && !normalize([point.sctid, point.term, point.semanticTag, ...Object.keys(point.categories), ...Object.keys(point.polarities), ...Object.keys(point.temporalities), ...Object.keys(point.subjects)].join(" ")).includes(normalizedQuery)) return false;
      if (category !== "all" && !point.categories[category]) return false;
      if (polarity !== "all" && !point.polarities[polarity]) return false;
      if (temporality !== "all" && !point.temporalities[temporality]) return false;
      if (subject !== "all" && !point.subjects[subject]) return false;
      return true;
    });
  }, [category, polarity, query, records, subject, temporality]);

  const points = useMemo<PositionedPoint[]>(() => visibleRecords.map((point) => ({
    ...point,
    ...(coordinateMap.get(point.sctid) ?? { x: 500, y: 310 }),
    colorLabel: colorLabelFor(point, colorMode),
    color: colorFor(colorLabelFor(point, colorMode)),
  })), [coordinateMap, visibleRecords, colorMode]);

  const selected = records.find((point) => point.sctid === selectedId) ?? null;
  const neighbors = selected?.neighbors.map((neighbor) => {
    const point = records.find((item) => item.sctid === neighbor.sctid);
    return point ? { ...point, ...(coordinateMap.get(point.sctid) ?? { x: 500, y: 310 }), colorLabel: colorLabelFor(point, colorMode), color: colorFor(colorLabelFor(point, colorMode)), similarity: neighbor.similarity } : null;
  }).filter(Boolean) as (PositionedPoint & { similarity: number })[] ?? [];
  const visibleEdges = showHierarchy ? (payload?.hierarchyEdges ?? []).map((edge) => {
    const sourcePoint = points.find((point) => point.sctid === edge.source);
    const targetPoint = points.find((point) => point.sctid === edge.target);
    return sourcePoint && targetPoint ? { sourcePoint, targetPoint } : null;
  }).filter(Boolean) as { sourcePoint: PositionedPoint; targetPoint: PositionedPoint }[] : [];

  const categories = unique(records.flatMap((point) => Object.keys(point.categories)));
  const polarities = unique(records.flatMap((point) => Object.keys(point.polarities)));
  const temporalities = unique(records.flatMap((point) => Object.keys(point.temporalities)));
  const subjects = unique(records.flatMap((point) => Object.keys(point.subjects)));
  const legendItems = unique(points.map((point) => point.colorLabel)).slice(0, 20).map((label) => ({ label, color: colorFor(label) }));
  const activeFilters = [category, polarity, temporality, subject].filter((value) => value !== "all").length;
  const resetFilters = () => { setCategory("all"); setPolarity("all"); setTemporality("all"); setSubject("all"); };
  const zoomTransform = `translate(500 310) scale(${zoom}) translate(-500 -310)`;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SEMANTIAR · ONTOLOGÍA SNOMED CT</p>
          <h1>Explorador de conceptos clínicos anotados</h1>
          <p className={styles.headerCopy}>Revisá qué conceptos clínicos fueron anotados y cómo se relacionan en la jerarquía SNOMED CT.</p>
        </div>
        <div className={styles.headerActions}>
          <a href={`${basePath}/`} className={styles.backLink}>← Volver al juego</a>
          <div className={styles.badge}><span className={styles.statusDot} /> <span><strong>{source?.annotatedSctidCount ?? "…"} conceptos anotados</strong><small>{source?.embeddedSctidCount ?? "…"} ubicados en el mapa</small></span></div>
        </div>
      </header>

      <div className={styles.grid}>
        <aside className={styles.panel + " " + styles.controls}>
          <p className={styles.kicker}>Qué representa</p>
          <h2>Un concepto clínico por círculo</h2>
          <p className={styles.muted}>La ubicación compara términos y descripciones de SNOMED CT. Las líneas muestran relaciones jerárquicas y los filtros resumen cómo fueron anotados los conceptos.</p>
          <div className={styles.methodCard}>
            <strong>{projectionLabel}</strong>
            <p>{projectionDescription}</p>
            <div className={styles.definition}><span>Conceptos cercanos</span><b>parecido terminológico</b></div>
            <p className={styles.small}>La cercanía no significa equivalencia ni relación de padre e hijo.</p>
            <div className={styles.definition}><span>Relación SNOMED</span><b>general / específico</b></div>
            <p className={styles.small}>Una línea une un concepto específico con un concepto más general.</p>
          </div>

          <label className={styles.label} htmlFor="snomed-search">Buscar concepto</label>
          <input id="snomed-search" className={styles.input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código SNOMED o nombre" />
          <label className={styles.label} htmlFor="projection">Forma de ordenar el mapa</label>
          <select id="projection" className={styles.input} value={projection} onChange={(event) => setProjection(event.target.value as Projection)}><option value="pca">Vista general del conjunto</option><option value="tsne">Conceptos parecidos entre sí</option></select>
          <label className={styles.label} htmlFor="color">Qué representa el color</label>
          <select id="color" className={styles.input} value={colorMode} onChange={(event) => setColorMode(event.target.value as ColorMode)}><option value="category">Categoría clínica de la anotación</option><option value="tag">Tipo de concepto SNOMED</option><option value="frequency">Frecuencia en las anotaciones</option><option value="annotators">Cantidad de anotadores</option></select>

          <div className={styles.filterSection}>
            <div className={styles.filterTitle}><b>Filtrar por características</b>{activeFilters > 0 && <button type="button" onClick={resetFilters}>Limpiar ({activeFilters})</button>}</div>
            <Filter label="Categoría" value={category} values={categories} onChange={setCategory} />
            <Filter label="Polaridad" value={polarity} values={polarities} onChange={setPolarity} />
            <Filter label="Temporalidad" value={temporality} values={temporalities} onChange={setTemporality} />
            <Filter label="Sujeto" value={subject} values={subjects} onChange={setSubject} />
          </div>
          <label className={styles.toggle}><input type="checkbox" checked={showHierarchy} onChange={(event) => setShowHierarchy(event.target.checked)} /><span><b>Mostrar líneas de la jerarquía</b><small>{source?.hierarchyEdgeCount ?? 0} relaciones disponibles</small></span></label>
          <div className={styles.metrics}><Metric value={points.length} label="conceptos visibles" /><Metric value={points.reduce((sum, point) => sum + point.occurrences, 0)} label="apariciones" /><Metric value={points.reduce((sum, point) => sum + point.caseCount, 0)} label="vínculos a casos" /><Metric value={source?.annotatorCount ?? 0} label="anotadores" /></div>
          <div className={styles.legend}><b>{colorMode === "category" ? "Categoría clínica de la anotación" : colorMode === "tag" ? "Tipo de concepto SNOMED" : colorMode === "frequency" ? "Frecuencia en las anotaciones" : "Cantidad de anotadores"}</b>{legendItems.map((item) => <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>)}</div>
          <div className={styles.source}><b>Datos públicos protegidos</b><span>No incluye texto clínico, identificadores de casos ni identificadores de anotadores.</span><span>{source?.editionLabel ?? "SNOMED CT"}</span></div>
        </aside>

        <section className={styles.panel + " " + styles.mapPanel}>
          <div className={styles.mapToolbar}><div><p className={styles.kicker}>¿Qué aporta este mapa?</p><h2>{projectionLabel}</h2><p className={styles.muted}>{projectionDescription}</p></div><div className={styles.zoom}><button type="button" onClick={() => setZoom((value) => Math.max(0.72, value - 0.15))}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(2.4, value + 0.15))}>+</button><button type="button" onClick={() => setZoom(1)}>Restablecer</button></div></div>
          <div className={styles.mapStage}>
            {error ? <div className={styles.mapMessage}>{error}</div> : !payload ? <div className={styles.mapMessage}>Cargando conceptos SNOMED…</div> : !points.length ? <div className={styles.mapMessage}>No hay conceptos que coincidan con la búsqueda o los filtros.</div> : <svg viewBox="0 0 1000 620" role="img" aria-label="Mapa de conceptos SNOMED">
              <defs><pattern id="snomed-grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M 42 0 L 0 0 0 42" fill="none" stroke="#e7eceb" strokeWidth="1" /></pattern><marker id="snomed-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8ebdb6" /></marker></defs>
              <rect width="1000" height="620" fill="url(#snomed-grid)" /><g transform={zoomTransform}>{showHierarchy && <g className={styles.edges}>{visibleEdges.map((edge) => <line key={`${edge.sourcePoint.sctid}-${edge.targetPoint.sctid}`} x1={edge.sourcePoint.x} y1={edge.sourcePoint.y} x2={edge.targetPoint.x} y2={edge.targetPoint.y} markerEnd="url(#snomed-arrow)" />)}</g>}{points.map((point) => <g key={point.sctid} tabIndex={0} role="button" aria-label={`${point.sctid} — ${point.term}`} className={styles.point} onClick={() => setSelectedId(point.sctid)} onMouseEnter={() => setHoveredId(point.sctid)} onMouseLeave={() => setHoveredId("")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(point.sctid); }}><circle className={`${styles.halo} ${selectedId === point.sctid ? styles.selectedHalo : ""}`} cx={point.x} cy={point.y} r="7" /><circle className={`${styles.core} ${selectedId === point.sctid ? styles.selectedCore : ""}`} cx={point.x} cy={point.y} r="4.2" fill={point.color} /></g>)}</g>
              {hoveredId && (() => { const point = points.find((item) => item.sctid === hoveredId); return point ? <g className={styles.tooltip} transform={`translate(${Math.min(720, Math.max(42, point.x - 5))} ${Math.min(500, Math.max(52, point.y - 65))})`}><rect width="248" height="56" rx="9" /><text x="12" y="20">{point.sctid}</text><text x="12" y="39" className={styles.tooltipTerm}>{point.term}</text></g> : null; })()}
              <text x="500" y="606" textAnchor="middle" className={styles.axis}>proyección 1</text><text x="18" y="310" textAnchor="middle" className={styles.axis} transform="rotate(-90 18 310)">proyección 2</text>
            </svg>}
          </div>
          <div className={styles.caption}><b>Cada círculo representa un concepto SNOMED CT presente en las anotaciones.</b><span>La cercanía indica parecido terminológico, no equivalencia clínica.</span>{showHierarchy && <span>Las líneas muestran relaciones de generalidad y especificidad en SNOMED CT.</span>}</div>
        </section>

        <aside className={styles.panel + " " + styles.details}>
          {!selected ? <div className={styles.empty}><div className={styles.emptyIcon}>＋</div><p className={styles.kicker}>Detalle de concepto</p><h2>Seleccioná un punto</h2><p>Vas a ver el código, el nombre SNOMED, su ubicación jerárquica, los atributos agregados y otros conceptos parecidos.</p></div> : <><div className={styles.detailHeader}><div><p className={styles.kicker}>Concepto seleccionado</p><h2>{selected.term}</h2></div><button type="button" className={styles.close} onClick={() => setSelectedId("")}>×</button></div><div className={styles.sctid}>{selected.sctid}<span>{selected.semanticTag || "sin etiqueta"}</span></div><div className={styles.detailMetrics}><Metric value={selected.occurrences} label="apariciones" /><Metric value={selected.caseCount} label="casos" /><Metric value={selected.annotatorCount} label="anotadores" /></div><DetailSection title="Ubicación en la jerarquía SNOMED"><p className={styles.muted}>Un concepto puede tener más de un concepto general como padre.</p><RelationGroup label="Conceptos más generales" relations={selected.parents} onSelect={setSelectedId} /><RelationGroup label="Conceptos más específicos" relations={selected.children} onSelect={setSelectedId} /></DetailSection><DetailSection title="Cómo fue anotado"><div className={styles.rows}>{entries(selected.categories).map(([key, value]) => <div key={`cat-${key}`}><span>Categoría · {key}</span><b>{value}</b></div>)}{entries(selected.polarities).map(([key, value]) => <div key={`pol-${key}`}><span>Polaridad · {key}</span><b>{value}</b></div>)}{entries(selected.temporalities).map(([key, value]) => <div key={`temp-${key}`}><span>Temporalidad · {key}</span><b>{value}</b></div>)}{entries(selected.subjects).map(([key, value]) => <div key={`sub-${key}`}><span>Sujeto · {key}</span><b>{value}</b></div>)}</div></DetailSection><DetailSection title="Conceptos más parecidos"><div className={styles.neighbors}>{neighbors.map((neighbor) => <button type="button" key={neighbor.sctid} onClick={() => setSelectedId(neighbor.sctid)}><i style={{ background: neighbor.color }} /><span><b>{neighbor.term}</b><small>{neighbor.sctid}</small></span><strong>{(neighbor.similarity * 100).toFixed(1)}%</strong></button>)}</div></DetailSection><DetailSection title="Texto clínico"><p className={styles.muted}>La publicación pública no contiene textos clínicos ni fragmentos de notas. Esta información sólo podría habilitarse en una versión local con anonimización previa.</p></DetailSection></>}
        </aside>
      </div>
    </main>
  );
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className={styles.filterLabel}>{label}<select className={styles.input} value={value} onChange={(event) => onChange(event.target.value)}><option value="all">Todas</option>{values.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>;
}

function Metric({ value, label }: { value: number | string; label: string }) {
  return <div className={styles.metric}><strong>{value}</strong><span>{label}</span></div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={styles.detailSection}><h3>{title}</h3>{children}</section>;
}

function RelationGroup({ label, relations, onSelect }: { label: string; relations: Relation[]; onSelect: (sctid: string) => void }) {
  return <div className={styles.relationGroup}><span className={styles.relationLabel}>{label}</span>{relations.length ? relations.map((relation) => <button type="button" key={relation.sctid} disabled={!relation.onMap} className={relation.onMap ? styles.relation : styles.relation + " " + styles.external} onClick={() => onSelect(relation.sctid)}><span>{relation.onMap ? "↗" : "·"}</span><span><b>{relation.term}</b><small>{relation.sctid} · {relation.onMap ? "en el mapa" : "fuera del conjunto"}</small></span></button>) : <span className={styles.noRelation}>No hay relaciones directas en el conjunto.</span>}</div>;
}

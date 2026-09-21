"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import styles from "./SnomedExplorer.module.css";

type Counts = Record<string, number>;
type View = "annotations" | "hierarchy" | "similarity";
type Projection = "pca" | "tsne";
type Relation = { sctid: string; term: string; onMap: boolean };
type Neighbor = { sctid: string; term: string; similarity: number };
type Point = {
  sctid: string; term: string; semanticTag: string; occurrences: number;
  caseCount: number; annotatorCount: number; categories: Counts;
  polarities: Counts; temporalities: Counts; subjects: Counts;
  parents: Relation[]; children: Relation[]; pca: [number, number];
  tsne: [number, number]; neighbors: Neighbor[];
};
type Methodology = {
  snomedEdition: string; snomedReleaseDate: string; representationModel: string;
  representationDimension: number; representationInput: string; similarityMetric: string;
  neighborScope: string; neighborsPerConcept: number; pcaExplainedVariance2D: number;
  tsnePerplexity: number; tsneMetric: string; tsneInitialization: string;
  tsneLearningRate: string; tsneIterations: number; randomSeed: number;
};
type Source = {
  editionLabel: string; generatedAt: string; annotatedSctidCount: number;
  embeddedSctidCount: number; missingSctidCount: number; annotatedCaseCount: number;
  annotationAssignmentCount?: number; annotatorCount: number; annotatedOccurrenceCount: number;
  hierarchyEdgeCount: number; hierarchyLinkedConceptCount?: number; methodology?: Methodology;
  publicDataPolicy: { clinicalTextIncluded: boolean; caseIdentifiersIncluded: boolean; annotatorIdentifiersIncluded: boolean; sourcePathsIncluded: boolean };
};
type Payload = { source: Source; hierarchyEdges: { source: string; target: string }[]; points: Point[] };
type PositionedPoint = Point & { x: number; y: number; color: string };

const COLORS: Record<string, string> = { "Hallazgo clínico": "#2563eb", Procedimiento: "#ea580c", Fármaco: "#9333ea" };
const VIEW_LABELS: Record<View, string> = { annotations: "Distribución de las anotaciones", hierarchy: "Jerarquía SNOMED CT", similarity: "Similitud terminológica" };
const numberFormat = new Intl.NumberFormat("es-AR");
const references = [
  ["SapBERT: representación de entidades biomédicas", "https://aclanthology.org/2021.naacl-main.334/"],
  ["Visualización de conjuntos de conceptos SNOMED CT", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3974253/"],
  ["TermViz: navegación jerárquica con foco y contexto", "https://pubmed.ncbi.nlm.nih.gov/17108619/"],
  ["WINS: revisión de SNOMED CT mediante grafos", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7233097/"],
  ["t-SNE y sus límites de interpretación", "https://www.nature.com/articles/s41467-019-13056-x"],
  ["Mapas conceptuales interactivos para la formación", "https://pubmed.ncbi.nlm.nih.gov/24909530/"],
  ["Desacuerdo en anotación clínica con SNOMED CT", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6307753/"],
] as const;

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const formatNumber = (value: number) => numberFormat.format(value);
const entries = (values: Counts) => Object.entries(values).sort((a, b) => b[1] - a[1]);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
const dominantCategory = (point: Point) => entries(point.categories)[0]?.[0] ?? "Sin categoría";
const categoryColor = (label: string) => COLORS[label] ?? "#64748b";
const pointRadius = (count: number) => Math.min(8.2, 3.2 + Math.log2(Math.max(1, count)) * 1.15);

function semanticTag(value: string) {
  const key = normalize(value).replace(/[()]/g, "");
  const labels: Record<string, string> = {
    finding: "Hallazgo", hallazgo: "Hallazgo", disorder: "Trastorno", trastorno: "Trastorno",
    procedure: "Procedimiento", procedimiento: "Procedimiento", substance: "Sustancia", sustancia: "Sustancia",
    "medicinal product": "Producto medicinal", "producto medicinal": "Producto medicinal",
    "clinical drug": "Medicamento clínico", "medicamento clinico": "Medicamento clínico",
    "body structure": "Estructura corporal", "estructura corporal": "Estructura corporal",
    organism: "Organismo", organismo: "Organismo", "qualifier value": "Valor calificador",
  };
  return labels[key] ?? (value.replace(/[()]/g, "") || "Entidad clínica");
}

export default function SnomedExplorer() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("annotations");
  const [projection, setProjection] = useState<Projection>("tsne");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [polarity, setPolarity] = useState("all");
  const [temporality, setTemporality] = useState("all");
  const [subject, setSubject] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideAnswer, setGuideAnswer] = useState<"correct" | "incorrect" | "">("");
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${basePath}/snomed-concepts-data.json`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(); return response.json() as Promise<Payload>; })
      .then((data) => { if (!data.points?.length) throw new Error(); setPayload(data); setError(""); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("No se pudo cargar el conjunto público de conceptos. Recargá la página o volvé a intentarlo más tarde.");
      });
    return () => controller.abort();
  }, [basePath]);

  const records = useMemo(() => payload?.points ?? [], [payload]);
  const recordMap = useMemo(() => new Map(records.map((point) => [point.sctid, point])), [records]);
  const categories = useMemo(() => unique(records.flatMap((point) => Object.keys(point.categories))), [records]);
  const polarities = useMemo(() => unique(records.flatMap((point) => Object.keys(point.polarities))), [records]);
  const temporalities = useMemo(() => unique(records.flatMap((point) => Object.keys(point.temporalities))), [records]);
  const subjects = useMemo(() => unique(records.flatMap((point) => Object.keys(point.subjects))), [records]);
  const filtered = useMemo(() => {
    const search = normalize(query);
    return records.filter((point) => {
      if (search && !normalize([point.sctid, point.term, semanticTag(point.semanticTag), ...Object.keys(point.categories)].join(" ")).includes(search)) return false;
      if (category !== "all" && !point.categories[category]) return false;
      if (polarity !== "all" && !point.polarities[polarity]) return false;
      if (temporality !== "all" && !point.temporalities[temporality]) return false;
      return subject === "all" || Boolean(point.subjects[subject]);
    });
  }, [category, polarity, query, records, subject, temporality]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => b.occurrences - a.occurrences || a.term.localeCompare(b.term, "es")), [filtered]);
  const selected = recordMap.get(selectedId) ?? null;
  const selectConcept = (sctid: string) => { setSelectedId(sctid); setHoveredId(""); };
  const openView = (next: View) => { setView(next); if (!selectedId && sorted[0]) setSelectedId(sorted[0].sctid); };
  const clearFilters = () => { setQuery(""); setCategory("all"); setPolarity("all"); setTemporality("all"); setSubject("all"); };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>SEMANTIAR · recurso educativo</p>
          <h1>Explorador educativo de conceptos clínicos anotados</h1>
          <p className={styles.headerCopy}>Permite revisar qué conceptos SNOMED CT fueron recuperados durante la anotación, cómo se ubican en la terminología y cuáles tienen nombres de significado parecido. Cada vista responde una pregunta diferente.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.backLink} href={`${basePath}/`}>← Volver al juego</a>
          <div className={styles.privacyBadge}><span className={styles.statusDot} aria-hidden="true" /><span><strong>Vista pública agregada</strong><small>Sin notas clínicas ni identificadores individuales</small></span></div>
        </div>
      </header>
      <section className={styles.scopeNotice} aria-label="Alcance de la herramienta">
        <strong>¿Qué aporta?</strong><span>Ayuda a reconocer patrones de uso, recorrer la jerarquía formal y discutir semejanzas terminológicas.</span><span>No mide prevalencia, gravedad, calidad asistencial ni equivalencia clínica.</span>
      </section>
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {!payload && !error ? <div className={styles.loading} role="status">Preparando el conjunto de conceptos…</div> : null}
      {payload ? <>
        <section className={styles.datasetSummary} aria-label="Resumen del conjunto">
          <SummaryMetric value={payload.source.annotatedOccurrenceCount} label="apariciones de conceptos" />
          <SummaryMetric value={payload.source.annotatedSctidCount} label="conceptos SNOMED CT distintos" />
          <SummaryMetric value={payload.source.annotatedCaseCount} label="textos o casos únicos" />
          <SummaryMetric value={payload.source.annotatorCount} label="anotadores incluidos" />
          {payload.source.annotationAssignmentCount ? <SummaryMetric value={payload.source.annotationAssignmentCount} label="asignaciones de anotación" /> : null}
        </section>
        <section className={styles.workspace}>
          <div className={styles.workspaceTop}>
            <div className={styles.tabs} role="tablist" aria-label="Formas de explorar el conjunto">
              {(Object.keys(VIEW_LABELS) as View[]).map((item, index) => <button type="button" role="tab" aria-selected={view === item} className={view === item ? styles.activeTab : undefined} key={item} onClick={() => openView(item)}><span>{index + 1}</span>{VIEW_LABELS[item]}</button>)}
            </div>
            <button type="button" className={guideOpen ? `${styles.guideToggle} ${styles.guideToggleActive}` : styles.guideToggle} onClick={() => { setGuideOpen((value) => !value); setGuideStep(0); setGuideAnswer(""); }}>{guideOpen ? "Cerrar recorrido" : "Iniciar recorrido guiado"}</button>
          </div>
          {guideOpen ? <LearningGuide step={guideStep} answer={guideAnswer} selected={selected} fallback={sorted[0] ?? records[0]} onSelect={selectConcept} onStep={setGuideStep} onAnswer={setGuideAnswer} onView={openView} /> : null}
          <div className={styles.finder}>
            <label><span>Buscar por nombre o código SNOMED CT</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: neumonía o 233604007" /></label>
            <label className={styles.conceptPicker}><span>Concepto seleccionado</span><select value={selectedId} onChange={(event) => selectConcept(event.target.value)}><option value="">Elegir un concepto</option>{sorted.map((point) => <option value={point.sctid} key={point.sctid}>{point.term} · {point.sctid}</option>)}</select></label>
          </div>
          <div role="tabpanel" aria-label={VIEW_LABELS[view]}>
            {view === "annotations" ? <AnnotationsView records={records} visible={filtered} sorted={sorted} source={payload.source} categories={categories} polarities={polarities} temporalities={temporalities} subjects={subjects} values={{ category, polarity, temporality, subject }} selected={selected} onValues={{ category: setCategory, polarity: setPolarity, temporality: setTemporality, subject: setSubject }} onClear={clearFilters} onSelect={selectConcept} recordMap={recordMap} /> : null}
            {view === "hierarchy" ? <HierarchyView selected={selected} source={payload.source} onSelect={selectConcept} /> : null}
            {view === "similarity" ? <SimilarityView records={records} visible={filtered} selected={selected} projection={projection} zoom={zoom} hoveredId={hoveredId} methodology={payload.source.methodology} categories={categories} category={category} onProjection={setProjection} onZoom={setZoom} onHover={setHoveredId} onSelect={selectConcept} onCategory={setCategory} recordMap={recordMap} /> : null}
          </div>
        </section>
        <MethodAndReferences source={payload.source} />
      </> : null}
    </main>
  );
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
  return <div className={styles.summaryMetric}><strong>{formatNumber(value)}</strong><span>{label}</span></div>;
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className={styles.filterLabel}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="all">Todas</option>{values.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>;
}

function LearningGuide({ step, answer, selected, fallback, onSelect, onStep, onAnswer, onView }: {
  step: number; answer: "correct" | "incorrect" | ""; selected: Point | null; fallback?: Point;
  onSelect: (id: string) => void; onStep: (step: number) => void;
  onAnswer: (answer: "correct" | "incorrect" | "") => void; onView: (view: View) => void;
}) {
  const concept = selected ?? fallback;
  const stages = [
    ["Elegí un concepto para seguirlo entre las vistas", "El mismo concepto puede estudiarse desde su uso en las anotaciones, su lugar en SNOMED CT y su parecido terminológico.", "Usar un ejemplo", "annotations"],
    ["Primero: observá cómo fue anotado", "Las cantidades describen este corpus. Una aparición frecuente no significa que la condición sea frecuente en una población.", "Continuar a la jerarquía", "hierarchy"],
    ["Después: ubicá el concepto en SNOMED CT", "Los padres directos son conceptos más generales; los hijos, más específicos. Esta relación formal es distinta del parecido entre nombres.", "Continuar a similitud", "similarity"],
  ] as const;
  const current = stages[Math.min(step, 2)];
  const advance = () => {
    if (step === 0 && concept) onSelect(concept.sctid);
    onView(current[3]); onStep(step + 1);
  };
  return <section className={styles.guide} aria-live="polite">
    <div className={styles.guideProgress}><span>Recorrido formativo</span><strong>Paso {Math.min(step + 1, 4)} de 4</strong></div>
    {step < 3 ? <div className={styles.guideContent}><div><h2>{current[0]}</h2><p>{current[1]}</p>{concept ? <small>Ejemplo activo: {concept.term}</small> : null}</div><button type="button" onClick={advance}>{current[2]} →</button></div> :
      <div className={styles.guideQuestion}><div><h2>Comprobación rápida</h2><p>Si dos puntos aparecen cerca en la vista de similitud, ¿qué conclusión es adecuada?</p></div><div className={styles.answerOptions}><button type="button" onClick={() => onAnswer("correct")}>Sus nombres tienen representaciones terminológicas parecidas.</button><button type="button" onClick={() => onAnswer("incorrect")}>Son diagnósticos equivalentes y pueden intercambiarse.</button></div>{answer ? <p className={answer === "correct" ? styles.correctAnswer : styles.incorrectAnswer}>{answer === "correct" ? "Correcto. La cercanía orienta una comparación terminológica; no demuestra equivalencia clínica." : "No. La cercanía no demuestra equivalencia, relación jerárquica ni posibilidad de sustitución clínica."}</p> : null}</div>}
  </section>;
}

type FilterValues = { category: string; polarity: string; temporality: string; subject: string };
function AnnotationsView({ records, visible, sorted, source, categories, polarities, temporalities, subjects, values, selected, onValues, onClear, onSelect, recordMap }: {
  records: Point[]; visible: Point[]; sorted: Point[]; source: Source; categories: string[];
  polarities: string[]; temporalities: string[]; subjects: string[]; values: FilterValues;
  selected: Point | null; onValues: { [Key in keyof FilterValues]: (value: string) => void };
  onClear: () => void; onSelect: (id: string) => void; recordMap: Map<string, Point>;
}) {
  const categoryTotals = useMemo(() => {
    const totals: Counts = {};
    for (const point of records) for (const [label, count] of Object.entries(point.categories)) totals[label] = (totals[label] ?? 0) + count;
    return entries(totals);
  }, [records]);
  const maximum = Math.max(1, ...categoryTotals.map((row) => row[1]));
  const disagreements = useMemo(() => records.filter((point) => Object.keys(point.categories).length > 1), [records]);
  const filteredOccurrences = visible.reduce((sum, point) => sum + point.occurrences, 0);
  return <div className={styles.viewStack}>
    <ViewIntro title="¿Qué conceptos se usaron y con qué atributos fueron anotados?">Resume decisiones de anotación dentro del conjunto cargado. Los recuentos describen el corpus; no representan frecuencia de enfermedades en la población.</ViewIntro>
    <div className={styles.annotationGrid}>
      <aside className={styles.filterPanel}>
        <div className={styles.panelHeading}><div><p className={styles.kicker}>Filtros</p><h3>Revisar subconjuntos</h3></div><button type="button" onClick={onClear}>Restablecer</button></div>
        <Filter label="Categoría de anotación" value={values.category} values={categories} onChange={onValues.category} />
        <Filter label="Polaridad" value={values.polarity} values={polarities} onChange={onValues.polarity} />
        <Filter label="Temporalidad" value={values.temporality} values={temporalities} onChange={onValues.temporality} />
        <Filter label="Sujeto" value={values.subject} values={subjects} onChange={onValues.subject} />
        <div className={styles.filterResult}><strong>{formatNumber(visible.length)}</strong><span>conceptos · {formatNumber(filteredOccurrences)} apariciones</span></div>
      </aside>
      <section className={styles.distributionPanel}>
        <div className={styles.panelHeading}><div><p className={styles.kicker}>Distribución</p><h3>Apariciones por categoría de anotación</h3></div></div>
        <div className={styles.bars}>{categoryTotals.map(([label, count]) => <div className={styles.barRow} key={label}><div><span><i style={{ background: categoryColor(label) }} />{label}</span><strong>{formatNumber(count)}</strong></div><div className={styles.barTrack}><span style={{ width: `${Math.max(2, count / maximum * 100)}%`, background: categoryColor(label) }} /></div></div>)}</div>
        <div className={styles.coverageCard}><div><strong>{formatNumber(source.embeddedSctidCount)} de {formatNumber(source.annotatedSctidCount)}</strong><span>conceptos pueden mostrarse en la vista de similitud</span></div><div className={styles.coverageTrack}><span style={{ width: `${source.embeddedSctidCount / source.annotatedSctidCount * 100}%` }} /></div><small>{formatNumber(source.missingSctidCount)} conceptos no se representaron porque no se encontraron en el índice terminológico utilizado.</small></div>
      </section>
      <section className={styles.reviewPanel}>
        <p className={styles.kicker}>Oportunidades de revisión</p><h3>{formatNumber(disagreements.length)} conceptos recibieron más de una categoría</h3>
        <p>Una diferencia no implica por sí sola un error. Puede señalar ambigüedad del texto, un criterio que necesita aclaración o usos distintos.</p>
        <div className={styles.reviewList}>{disagreements.slice(0, 6).map((point) => <button type="button" key={point.sctid} onClick={() => onSelect(point.sctid)}><span>{point.term}</span><small>{entries(point.categories).map(([label, count]) => `${label}: ${count}`).join(" · ")}</small></button>)}{!disagreements.length ? <span className={styles.emptyText}>No se detectaron conceptos con categorías diferentes.</span> : null}</div>
      </section>
    </div>
    <div className={styles.listAndDetail}>
      <section className={styles.conceptListPanel}>
        <div className={styles.panelHeading}><div><p className={styles.kicker}>Conceptos visibles</p><h3>Ordenados por cantidad de apariciones</h3></div><span>{formatNumber(sorted.length)} resultados</span></div>
        <div className={styles.conceptList}>{sorted.slice(0, 40).map((point) => <button type="button" key={point.sctid} className={selected?.sctid === point.sctid ? styles.selectedListItem : undefined} onClick={() => onSelect(point.sctid)}><i style={{ background: categoryColor(dominantCategory(point)) }} /><span><strong>{point.term}</strong><small>{point.sctid} · {semanticTag(point.semanticTag)}</small></span><b>{point.occurrences}</b></button>)}{!sorted.length ? <p className={styles.emptyText}>No hay conceptos que cumplan los filtros.</p> : null}</div>
      </section>
      <ConceptDetail point={selected} mode="annotations" onSelect={onSelect} recordMap={recordMap} />
    </div>
  </div>;
}

function ViewIntro({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.viewIntro}><div><p className={styles.kicker}>Pregunta que responde esta vista</p><h2>{title}</h2></div><p>{children}</p></section>;
}

function HierarchyView({ selected, source, onSelect }: { selected: Point | null; source: Source; onSelect: (id: string) => void }) {
  return <div className={styles.viewStack}>
    <ViewIntro title="¿Dónde se ubica el concepto en la jerarquía de SNOMED CT?">Muestra relaciones directas de tipo «es un/una». Los conceptos de arriba son más generales; los de abajo, más específicos. No son asociaciones extraídas de las notas.</ViewIntro>
    {!selected ? <EmptySelection message="Elegí un concepto para ver sus padres e hijos directos en la terminología." /> : <div className={styles.hierarchyLayout}>
      <section className={styles.hierarchyDiagram} aria-label={`Jerarquía directa de ${selected.term}`}>
        <RelationLevel title="Conceptos más generales · padres directos" relations={selected.parents} kind="padres" onSelect={onSelect} />
        <div className={styles.hierarchyConnector}><span>es un/una</span><i aria-hidden="true">↓</i></div>
        <article className={styles.focusConcept}><small>Concepto seleccionado</small><h3>{selected.term}</h3><code>{selected.sctid}</code><span>{semanticTag(selected.semanticTag)}</span></article>
        <div className={styles.hierarchyConnector}><i aria-hidden="true">↓</i><span>incluye como tipos más específicos</span></div>
        <RelationLevel title="Conceptos más específicos · hijos directos" relations={selected.children} kind="hijos" onSelect={onSelect} />
      </section>
      <aside className={styles.hierarchyExplanation}><p className={styles.kicker}>Cómo leerla</p><h3>La jerarquía organiza significado clínico formal</h3><ol><li>Seleccioná un concepto.</li><li>Revisá sus padres directos para comprender la categoría más general.</li><li>Revisá sus hijos para reconocer opciones más específicas.</li></ol><div className={styles.methodFact}><strong>{formatNumber(source.hierarchyEdgeCount)}</strong><span>relaciones directas conectan dos conceptos que también aparecen en el mapa.</span></div><p>Un concepto puede tener varios padres. Que dos conceptos sean parecidos en la vista terminológica no significa que tengan esta relación formal.</p></aside>
    </div>}
  </div>;
}

function RelationLevel({ title, relations, kind, onSelect }: { title: string; relations: Relation[]; kind: string; onSelect: (id: string) => void }) {
  return <section className={styles.relationLevel}><h3>{title}</h3><div>{relations.map((relation) => relation.onMap ? <button type="button" key={relation.sctid} onClick={() => onSelect(relation.sctid)}><strong>{relation.term}</strong><small>{relation.sctid} · abrir concepto</small></button> : <article key={relation.sctid}><strong>{relation.term}</strong><small>{relation.sctid} · relacionado en SNOMED CT, no anotado en este conjunto</small></article>)}{!relations.length ? <p className={styles.emptyText}>No se encontraron {kind} directos en la edición utilizada.</p> : null}</div></section>;
}

function SimilarityView({ records, visible, selected, projection, zoom, hoveredId, methodology, categories, category, onProjection, onZoom, onHover, onSelect, onCategory, recordMap }: {
  records: Point[]; visible: Point[]; selected: Point | null; projection: Projection; zoom: number;
  hoveredId: string; methodology?: Methodology; categories: string[]; category: string;
  onProjection: (value: Projection) => void; onZoom: (value: number) => void;
  onHover: (id: string) => void; onSelect: (id: string) => void; onCategory: (value: string) => void;
  recordMap: Map<string, Point>;
}) {
  const coordinates = useMemo(() => {
    if (!records.length) return new Map<string, { x: number; y: number }>();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const values = records.map((point) => {
      const value = projection === "pca" ? point.pca : point.tsne;
      minX = Math.min(minX, value[0]); maxX = Math.max(maxX, value[0]);
      minY = Math.min(minY, value[1]); maxY = Math.max(maxY, value[1]);
      return value;
    });
    const ratio = (value: number, minimum: number, maximum: number) => minimum === maximum ? .5 : (value - minimum) / (maximum - minimum);
    return new Map(records.map((point, index) => [point.sctid, { x: 68 + ratio(values[index][0], minX, maxX) * 864, y: 48 + (1 - ratio(values[index][1], minY, maxY)) * 514 }]));
  }, [projection, records]);
  const points = useMemo<PositionedPoint[]>(() => visible.map((point) => ({ ...point, ...(coordinates.get(point.sctid) ?? { x: 500, y: 305 }), color: categoryColor(dominantCategory(point)) })), [coordinates, visible]);
  const hovered = points.find((point) => point.sctid === hoveredId) ?? null;
  const selectedPosition = selected ? coordinates.get(selected.sctid) : null;
  const neighbors = selected?.neighbors.flatMap((neighbor) => {
    const point = recordMap.get(neighbor.sctid), position = coordinates.get(neighbor.sctid);
    return point && position ? [{ ...point, ...position }] : [];
  }) ?? [];
  const pcaPercent = (methodology?.pcaExplainedVariance2D ?? .085) * 100;
  return <div className={styles.viewStack}>
    <ViewIntro title="¿Qué conceptos tienen nombres de significado terminológico parecido?">La cercanía ayuda a proponer comparaciones. No demuestra que dos conceptos sean equivalentes, intercambiables, ni que estén unidos por una relación jerárquica.</ViewIntro>
    <div className={styles.similarityLayout}>
      <aside className={styles.similarityControls}>
        <p className={styles.kicker}>Modo de representación</p>
        <div className={styles.projectionOptions}>
          <button type="button" className={projection === "tsne" ? styles.selectedOption : undefined} onClick={() => onProjection("tsne")}><strong>Vecindad terminológica</strong><span>t-SNE · recomendada para revisar cercanías locales</span></button>
          <button type="button" className={projection === "pca" ? styles.selectedOption : undefined} onClick={() => onProjection("pca")}><strong>Panorama lineal</strong><span>PCA · vista técnica complementaria</span></button>
        </div>
        <Filter label="Mostrar categoría" value={category} values={categories} onChange={onCategory} />
        <div className={styles.legend}><strong>Color = categoría de anotación</strong>{categories.map((label) => <span key={label}><i style={{ background: categoryColor(label) }} />{label}</span>)}<small>El tamaño aumenta con la cantidad de apariciones.</small></div>
        <div className={styles.readingNote}><strong>{projection === "tsne" ? "Lectura local" : "Lectura global aproximada"}</strong><p>{projection === "tsne" ? "Interpretá sobre todo los vecinos inmediatos. La distancia entre grupos alejados y el tamaño de los grupos pueden ser engañosos." : `Los dos ejes conservan aproximadamente ${pcaPercent.toFixed(1)}% de la variación original; esta vista resume, pero no reproduce, toda la información.`}</p></div>
      </aside>
      <section className={styles.mapPanel}>
        <div className={styles.mapToolbar}><div><p className={styles.kicker}>{projection === "tsne" ? "Vecindad terminológica · t-SNE" : "Panorama lineal · PCA"}</p><h3>{formatNumber(points.length)} conceptos visibles</h3></div><div className={styles.zoom} aria-label="Controles de ampliación"><button type="button" aria-label="Alejar" onClick={() => onZoom(Math.max(.75, zoom - .25))}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Acercar" onClick={() => onZoom(Math.min(2.25, zoom + .25))}>+</button><button type="button" onClick={() => onZoom(1)}>Restablecer</button></div></div>
        <div className={styles.mapStage}>{!points.length ? <div className={styles.mapMessage}>No hay conceptos que cumplan los filtros.</div> : <svg viewBox="0 0 1000 610" role="img" aria-labelledby="map-title map-description"><title id="map-title">Mapa de similitud terminológica</title><desc id="map-description">Cada círculo es un concepto. La cercanía aproxima semejanza entre nombres; el color indica categoría y el tamaño, cantidad de apariciones.</desc><g transform={`translate(500 305) scale(${zoom}) translate(-500 -305)`}>{selectedPosition ? <g className={styles.neighborLines}>{neighbors.map((neighbor) => <line key={neighbor.sctid} x1={selectedPosition.x} y1={selectedPosition.y} x2={neighbor.x} y2={neighbor.y} />)}</g> : null}{points.map((point) => <g className={styles.point} key={point.sctid} onMouseEnter={() => onHover(point.sctid)} onMouseLeave={() => onHover("")} onClick={() => onSelect(point.sctid)}><title>{point.term} · {point.sctid} · {point.occurrences} apariciones</title>{selected?.sctid === point.sctid ? <circle className={styles.selectedHalo} cx={point.x} cy={point.y} r={pointRadius(point.occurrences) + 6} /> : null}<circle className={styles.pointCore} cx={point.x} cy={point.y} r={pointRadius(point.occurrences)} fill={point.color} opacity={selected && selected.sctid !== point.sctid && !selected.neighbors.some((item) => item.sctid === point.sctid) ? .32 : .82} /></g>)}{hovered ? <g className={styles.tooltip} transform={`translate(${Math.min(735, Math.max(16, hovered.x + 10))} ${Math.min(540, Math.max(18, hovered.y - 62))})`}><rect width="250" height="52" rx="8" /><text x="12" y="19">{hovered.sctid}</text><text x="12" y="38">{hovered.term.slice(0, 38)}</text></g> : null}</g></svg>}</div>
        <p className={styles.mapCaption}>Cada círculo representa un concepto SNOMED CT presente en las anotaciones. La posición surge de una representación numérica del nombre preferido del concepto; no incorpora el texto de la nota clínica.</p>
      </section>
      <ConceptDetail point={selected} mode="similarity" onSelect={onSelect} recordMap={recordMap} />
    </div>
  </div>;
}

function ConceptDetail({ point, mode, onSelect, recordMap }: { point: Point | null; mode: "annotations" | "similarity"; onSelect: (id: string) => void; recordMap: Map<string, Point> }) {
  if (!point) return <EmptySelection message={mode === "similarity" ? "Seleccioná un círculo o elegí un concepto para revisar sus vecinos terminológicos." : "Seleccioná un concepto para revisar sus atributos agregados."} />;
  return <aside className={styles.detailPanel} aria-live="polite">
    <p className={styles.kicker}>Concepto seleccionado</p><h3>{point.term}</h3><div className={styles.conceptCode}><code>{point.sctid}</code><span>{semanticTag(point.semanticTag)}</span></div>
    <div className={styles.detailMetrics}><SummaryMetric value={point.occurrences} label="apariciones" /><SummaryMetric value={point.caseCount} label="textos/casos" /><SummaryMetric value={point.annotatorCount} label="anotadores" /></div>
    <DetailSection title="Cómo fue anotado"><CountRows label="Categoría" values={point.categories} /><CountRows label="Polaridad" values={point.polarities} /><CountRows label="Temporalidad" values={point.temporalities} /><CountRows label="Sujeto" values={point.subjects} /></DetailSection>
    {mode === "similarity" ? <DetailSection title="Vecinos terminológicos"><p className={styles.detailHelp}>El valor va de −1 a 1: cuanto más próximo a 1, mayor semejanza entre las representaciones de los nombres. No es una probabilidad ni una recomendación clínica.</p><div className={styles.neighborList}>{point.neighbors.map((neighbor) => { const target = recordMap.get(neighbor.sctid); return <button type="button" key={neighbor.sctid} onClick={() => onSelect(neighbor.sctid)}><i style={{ background: categoryColor(target ? dominantCategory(target) : "") }} /><span><strong>{neighbor.term}</strong><small>{neighbor.sctid}</small></span><b>{neighbor.similarity.toFixed(2)}</b></button>; })}</div></DetailSection> : null}
  </aside>;
}

function CountRows({ label, values }: { label: string; values: Counts }) {
  const rows = entries(values);
  return rows.length ? <div className={styles.countRows}>{rows.map(([name, count]) => <div key={`${label}-${name}`}><span>{label} · {name}</span><strong>{count}</strong></div>)}</div> : null;
}
function DetailSection({ title, children }: { title: string; children: ReactNode }) { return <section className={styles.detailSection}><h4>{title}</h4>{children}</section>; }
function EmptySelection({ message }: { message: string }) { return <aside className={styles.emptySelection}><span aria-hidden="true">＋</span><div><h3>Seleccioná un concepto</h3><p>{message}</p></div></aside>; }

function MethodAndReferences({ source }: { source: Source }) {
  const method = source.methodology;
  const generated = new Date(source.generatedAt);
  return <section className={styles.methodology}>
    <div className={styles.methodologyHeading}><p className={styles.kicker}>Transparencia metodológica</p><h2>Cómo se construyó esta vista y qué límites tiene</h2><p>La explicación técnica se mantiene disponible para que la lectura educativa pueda auditarse y reproducirse.</p></div>
    <div className={styles.detailsGrid}>
      <details open><summary>Tarea realizada</summary><ol><li>Se reunieron los códigos SNOMED CT seleccionados y se calcularon recuentos agregados.</li><li>Los códigos se vincularon con la edición argentina y sus relaciones directas «es un/una».</li><li>El nombre preferido de cada concepto se transformó en una representación numérica terminológica.</li><li>Se calcularon vecinos por similitud coseno y dos vistas bidimensionales: t-SNE y PCA.</li></ol></details>
      <details><summary>Datos y parámetros</summary><dl><div><dt>Terminología</dt><dd>{method?.snomedEdition ?? source.editionLabel}</dd></div><div><dt>Fecha de edición</dt><dd>{method?.snomedReleaseDate ?? "2025-05-31"}</dd></div><div><dt>Modelo terminológico</dt><dd>{method?.representationModel ?? "SapBERT multilingüe"}</dd></div><div><dt>Entrada</dt><dd>{method?.representationInput ?? "Nombre preferido del concepto"}</dd></div><div><dt>Similitud</dt><dd>{method?.similarityMetric ?? "Coseno"}; sólo entre conceptos representados</dd></div><div><dt>t-SNE</dt><dd>Perplejidad {method?.tsnePerplexity ?? 30}; {method?.tsneIterations ?? 750} iteraciones; semilla {method?.randomSeed ?? 42}</dd></div><div><dt>Generación</dt><dd>{Number.isNaN(generated.getTime()) ? source.generatedAt : generated.toLocaleString("es-AR")}</dd></div></dl></details>
      <details><summary>Privacidad y límites</summary><ul><li>No se publican textos, fragmentos, identificadores de casos ni de anotadores.</li><li>Los recuentos reflejan este conjunto; no permiten estimar prevalencia.</li><li>La similitud usa nombres terminológicos, no el contexto de cada aparición.</li><li>Los vecinos sirven para explorar y formular preguntas; requieren revisión humana.</li></ul></details>
      <details><summary>Fundamento científico y lecturas</summary><p>Estos trabajos sostienen componentes del enfoque; no equivalen a una validación de esta interfaz concreta.</p><ul className={styles.referenceList}>{references.map(([label, href]) => <li key={href}><a href={href} target="_blank" rel="noreferrer">{label} ↗</a></li>)}</ul></details>
    </div>
    <div className={styles.futureWork}><strong>Próxima validación recomendada</strong><span>Prueba de usabilidad con profesionales de la salud, tareas de interpretación predefinidas, registro de errores de lectura y comparación de t-SNE con UMAP/PaCMAP antes de incorporar nuevas vistas.</span></div>
  </section>;
}

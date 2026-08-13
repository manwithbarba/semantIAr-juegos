"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  quizData,
  pickRoundItems,
  buildTermOptions,
  CATEGORIES,
  POLARITIES,
  CERTAINTIES,
  TEMPORALITIES,
  SUBJECTS,
} from "@/lib/quiz";
import type { QuestionKind, QuizItem, Difficulty, GameStats } from "@/lib/types";
import { HighlightedText } from "./HighlightedText";

const ROUND_SIZE = 10;

type Answers = Partial<Record<QuestionKind, string>>;

type RoundLog = {
  item: QuizItem;
  answers: Answers;
  score: number; // 0..4
};

function isCorrect(item: QuizItem, kind: QuestionKind, value: string) {
  switch (kind) {
    case "cat":
      return value === item.cat;
    case "pol":
      return value === item.pol;
    case "cert":
      return value === item.cert;
    case "temp":
      return value === item.temp;
    case "suj":
      return value === item.suj;
    case "term":
      return value === item.term;
  }
}

const TOOLTIP_DATA: Record<QuestionKind, { title: string; defs: { name: string; desc: string }[] }> = {
  cat: {
    title: "Categoría Clínica",
    defs: [
      { name: "Hallazgo clínico", desc: "Síntomas, signos, diagnósticos y juicios clínicos (ej: dolor, disnea, HTA)." },
      { name: "Procedimiento", desc: "Acciones o intervenciones médicas, quirúrgicas, de enfermería o kinesiología (ej: ARM, extracción)." },
      { name: "Fármaco", desc: "Productos medicinales o sustancias químicas administradas (ej: fentanilo, midazolam)." }
    ]
  },
  pol: {
    title: "Polaridad del Concepto",
    defs: [
      { name: "Activo", desc: "El concepto está presente o confirmado en el paciente (ej: 'presenta eupnea')." },
      { name: "Negado", desc: "El concepto está explícitamente ausente, descartado o negado (ej: 'afebril', 'no presenta', 'catarsis(-)')." }
    ]
  },
  cert: {
    title: "Grado de Certeza",
    defs: [
      { name: "Confirmado", desc: "Es una certeza clínica documentada o un hecho clínico firme." },
      { name: "Sospecha", desc: "Existe sospecha diagnóstica o un grado de duda clínica activa (ej: 'probable', 'presunto')." },
      { name: "Diferencial", desc: "Se propone como diagnóstico diferencial o descarte (ej: 'descartar neumonía')." }
    ]
  },
  temp: {
    title: "Temporalidad",
    defs: [
      { name: "Actual", desc: "Ocurre en el momento del episodio o consulta clínica bajo análisis." },
      { name: "Histórico", desc: "Se refiere a antecedentes del pasado del paciente (ej: 'operado hace 2 años')." }
    ]
  },
  suj: {
    title: "Sujeto de la Relación",
    defs: [
      { name: "Paciente", desc: "El concepto clínico describe el estado directo del paciente evaluado." },
      { name: "Familiar", desc: "El concepto describe antecedentes de familiares o terceros (ej: 'madre con HTA')." }
    ]
  },
  term: {
    title: "Término SNOMED CT",
    defs: [
      { name: "Codificación", desc: "Selecciona el término clínico y SCTID que represente con mayor fidelidad semántica el literal de la nota." }
    ]
  }
};

const CONSENSUS_RULES = [
  {
    key: "SPO2",
    match: (text: string, literal: string) => 
      literal.toLowerCase().includes("spo2") || text.toLowerCase().includes("spo2"),
    title: "Criterio de Consenso: SPO2 (Oxigenometría)",
    desc: "Los registros de saturación de oxígeno (ej. 'SPO2 93%') se modelan como Hallazgo clínico (SCTID: 448225001 |saturación de oxígeno dentro del rango de referencia|), no como procedimientos de medición."
  },
  {
    key: "BIC",
    match: (text: string, literal: string) => 
      literal.toLowerCase().includes("bic") || literal.toLowerCase().includes("bomba de infusion") || literal.toLowerCase().includes("fnt") || literal.toLowerCase().includes("mdz"),
    title: "Criterio de Consenso: BIC (Bombas de Infusión)",
    desc: "Las infusiones continuas por bomba (como 'BIC FNT' o 'BIC MDZ') se categorizan bajo la jerarquía de Fármaco con el producto terapéutico asociado, no como procedimientos de infusión."
  },
  {
    key: "ARM",
    match: (text: string, literal: string) => 
      literal.toLowerCase().includes("arm") || literal.toLowerCase().includes("ventilatorio") || literal.toLowerCase().includes("mni"),
    title: "Criterio de Consenso: ARM (Asistencia Respiratoria)",
    desc: "Conceptos como 'en ARM' o 'parámetros ventilatorios' se clasifican como Procedimiento bajo el término específico de 'ventilación mecánica invasiva' (SCTID: 1258985005)."
  }
];

const HANDWRITING_FONTS = [
  "font-hand-caveat",
  "font-hand-architects",
  "font-hand-indie",
  "font-hand-patrick",
];

export default function QuizGame() {
  const [phase, setPhase] = useState<"start" | "playing" | "review" | "done">("start");
  const [items, setItems] = useState<QuizItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [locked, setLocked] = useState(false);
  const [log, setLog] = useState<RoundLog[]>([]);
  const [sugerencia, setSugerencia] = useState("");
  const [sugerido, setSugerido] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [stats, setStats] = useState<GameStats | null>(null);
  const [reportType, setReportType] = useState<"error" | "rule" | "synonyms">("error");
  const [proposedRule, setProposedRule] = useState("");
  const [localSynonyms, setLocalSynonyms] = useState<string[]>([]);
  const [synonymInput, setSynonymInput] = useState("");
  const savedLogRef = useRef<RoundLog[] | null>(null);

  const current = items[index];

  const activeRules = useMemo(() => {
    if (!current || !locked) return [];
    return CONSENSUS_RULES.filter((rule) => rule.match(current.text, current.literal));
  }, [current, locked]);

  useEffect(() => {
    const raw = localStorage.getItem("semantiar_quiz_stats");
    if (raw) {
      const loadStats = window.setTimeout(() => {
        try {
          setStats(JSON.parse(raw) as GameStats);
        } catch (e) {
          console.error(e);
        }
      }, 0);
      return () => window.clearTimeout(loadStats);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (phase === "done" && log.length > 0 && savedLogRef.current !== log) {
      savedLogRef.current = log;
      const score = log.reduce((a, r) => a + r.score, 0);
      const max = log.length * 6;
      
      const currentRoundStats: Record<string, { attempts: number; errors: number }> = {
        cat: { attempts: 0, errors: 0 },
        pol: { attempts: 0, errors: 0 },
        cert: { attempts: 0, errors: 0 },
        temp: { attempts: 0, errors: 0 },
        suj: { attempts: 0, errors: 0 },
        term: { attempts: 0, errors: 0 },
      };

      log.forEach((r) => {
        const dims: QuestionKind[] = ["cat", "pol", "cert", "temp", "suj", "term"];
        dims.forEach((d) => {
          currentRoundStats[d].attempts += 1;
          if (!isCorrect(r.item, d, r.answers[d] || "")) {
            currentRoundStats[d].errors += 1;
          }
        });
      });

      const combinedDimensionStats = { ...(stats?.dimensionStats || {}) };
      Object.keys(currentRoundStats).forEach((k) => {
        const existing = combinedDimensionStats[k] || { attempts: 0, errors: 0 };
        combinedDimensionStats[k] = {
          attempts: existing.attempts + currentRoundStats[k].attempts,
          errors: existing.errors + currentRoundStats[k].errors,
        };
      });
      
      const newStats: GameStats = stats 
        ? {
            roundsPlayed: stats.roundsPlayed + 1,
            totalScore: stats.totalScore + score,
            maxScore: stats.maxScore + max,
            bestScore: Math.max(stats.bestScore, score),
            history: [
              ...stats.history,
              { timestamp: Date.now(), score, maxScore: max, difficulty }
            ],
            dimensionStats: combinedDimensionStats
          }
        : {
            roundsPlayed: 1,
            totalScore: score,
            maxScore: max,
            bestScore: score,
            history: [
              { timestamp: Date.now(), score, maxScore: max, difficulty }
            ],
            dimensionStats: currentRoundStats
          };
          
      const saveStats = window.setTimeout(() => {
        setStats(newStats);
        localStorage.setItem("semantiar_quiz_stats", JSON.stringify(newStats));
      }, 0);
      return () => window.clearTimeout(saveStats);
    }
    return undefined;
  }, [difficulty, log, phase, stats]);

  const badges = useMemo(() => {
    if (phase !== "done" || log.length === 0) return [];
    const list: { emoji: string; title: string; desc: string }[] = [];
    
    const score = log.reduce((a, r) => a + r.score, 0);
    const max = log.length * 6;
    
    if (score >= max * 0.9) {
      list.push({
        emoji: "🏆",
        title: "Anotador Impecable",
        desc: "Obtuviste 90% o más de aciertos en la ronda."
      });
    }
    
    const allTermCorrect = log.every((r) => isCorrect(r.item, "term", r.answers.term || ""));
    if (allTermCorrect) {
      list.push({
        emoji: "🔬",
        title: "Precisión SNOMED CT",
        desc: "Codificaste correctamente el término SNOMED CT en todos los casos."
      });
    }
    
    const allSujCorrect = log.every((r) => isCorrect(r.item, "suj", r.answers.suj || ""));
    if (allSujCorrect) {
      list.push({
        emoji: "👁️",
        title: "Ojo Clínico",
        desc: "Acertaste el sujeto de la relación (Paciente/Familiar) en toda la ronda."
      });
    }
    
    let maxStreak = 0;
    let currentStreak = 0;
    for (const r of log) {
      if (r.score === 6) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    if (maxStreak >= 3) {
      list.push({
        emoji: "⚡",
        title: "Racha Dorada",
        desc: `Puntaje perfecto (6/6) en ${maxStreak} casos consecutivos.`
      });
    }
    
    return list;
  }, [phase, log]);

  const termOptions = useMemo(() => {
    if (!current) return [];
    return buildTermOptions(current, quizData, 4);
  }, [current]);

  function startGame(selectedDiff?: Difficulty) {
    const diff = selectedDiff || difficulty;
    setItems(pickRoundItems(ROUND_SIZE, diff));
    setIndex(0);
    setAnswers({});
    setLocked(false);
    setLog([]);
    setSugerencia("");
    setSugerido(false);
    setReportType("error");
    setProposedRule("");
    setLocalSynonyms([]);
    setSynonymInput("");
    setPhase("playing");
  }

  function selectAnswer(kind: QuestionKind, value: string) {
    if (locked) return;
    setAnswers((prev) => ({ ...prev, [kind]: value }));
  }

  function allAnswered() {
    return (["cat", "pol", "cert", "temp", "suj", "term"] as QuestionKind[]).every(
      (k) => answers[k]
    );
  }

  function confirmAnswers() {
    if (!current || !allAnswered()) return;
    setLocked(true);
    const kinds: QuestionKind[] = ["cat", "pol", "cert", "temp", "suj", "term"];
    const score = kinds.reduce(
      (acc, k) => acc + (isCorrect(current, k, answers[k]!) ? 1 : 0),
      0
    );
    setLog((prev) => [...prev, { item: current, answers, score }]);
  }

  function nextCase() {
    if (index + 1 >= items.length) {
      setPhase("done");
      return;
    }
    setIndex((i) => i + 1);
    setAnswers({});
    setLocked(false);
    setSugerencia("");
    setProposedRule("");
    setLocalSynonyms([]);
    setSynonymInput("");
    setReportType("error");
    setSugerido(false);
  }

  const totalScore = log.reduce((a, r) => a + r.score, 0);
  const maxScore = log.length * 6;

  if (phase === "start") {
    const avgScore = stats && stats.roundsPlayed > 0 
      ? Math.round((stats.totalScore / stats.maxScore) * 100) 
      : 0;

    let worstDimension: { name: string; pct: number } | null = null;
    if (stats && stats.dimensionStats) {
      let maxErrorRate = -1;
      let worstDimKey = "";
      
      const friendlyNames: Record<string, string> = {
        cat: "Categoría",
        pol: "Polaridad",
        cert: "Certeza",
        temp: "Temporalidad",
        suj: "Sujeto de Relación",
        term: "Término SNOMED CT",
      };

      Object.entries(stats.dimensionStats).forEach(([dim, data]) => {
        if (data.attempts > 0) {
          const rate = data.errors / data.attempts;
          if (rate > maxErrorRate && data.errors > 0) {
            maxErrorRate = rate;
            worstDimKey = dim;
          }
        }
      });

      if (worstDimKey) {
        worstDimension = {
          name: friendlyNames[worstDimKey] || worstDimKey,
          pct: Math.round(maxErrorRate * 100),
        };
      }
    }

    return (
      <div className="max-w-2xl mx-auto text-center px-6 py-10">
        <h1 className="text-3xl font-bold mb-3">🧠 SEMANTIAR Quiz</h1>
        <p className="text-neutral-600 dark:text-neutral-300 mb-4">
          Practicá la semántica clínica de anotaciones reales extraídas del corpus de SemantIAr: categoría, polaridad, certeza, temporalidad, sujeto de la relación y término SNOMED CT.
        </p>
        
        <div className="max-w-md mx-auto mb-6 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded text-xs text-amber-800 dark:text-amber-300">
          <strong>⚠️ Aviso Educativo:</strong> Esta aplicación tiene un fin estrictamente educativo y recreativo. No cuenta con validación clínica ni asistencial de ningún tipo.
        </div>

        {stats && stats.roundsPlayed > 0 && (
          <div className="max-w-md mx-auto mb-8 p-4 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 rounded-xl text-left">
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-1.5">
              📊 Historial de Rendimiento Local
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="p-2 bg-neutral-100 dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="block text-xs text-neutral-500">Rondas</span>
                <span className="text-lg font-bold text-neutral-800 dark:text-neutral-200">{stats.roundsPlayed}</span>
              </div>
              <div className="p-2 bg-neutral-100 dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="block text-xs text-neutral-500">Promedio</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{avgScore}%</span>
              </div>
              <div className="p-2 bg-neutral-100 dark:bg-neutral-900 rounded border border-neutral-200 dark:border-neutral-800">
                <span className="block text-xs text-neutral-500">Récord</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.bestScore}/60</span>
              </div>
            </div>
            {worstDimension && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-lg text-xs text-rose-800 dark:text-rose-300 flex items-center gap-1.5 animate-fadeIn">
                <span>⚠️</span>
                <span>
                  <strong>Dimensión a reforzar:</strong> {worstDimension.name} ({worstDimension.pct}% de discrepancias). ¡Utilizá los tooltips de ayuda metodológica <code>❓</code> durante el quiz!
                </span>
              </div>
            )}
          </div>
        )}

        <div className="max-w-md mx-auto mb-8 text-left">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Seleccionar nivel de dificultad:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["facil", "normal", "dificil"] as Difficulty[]).map((d) => {
              const active = difficulty === d;
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-lg border py-2 text-xs font-semibold capitalize transition-all ${
                    active
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 shadow-sm font-bold"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  {d === "facil" ? "Fácil" : d === "normal" ? "Normal" : "Difícil"}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-neutral-400 mt-2 text-center">
            {difficulty === "facil" && "Fácil: Notas cortas (menos de 130 caracteres) y lectura veloz."}
            {difficulty === "normal" && "Normal: Notas de longitud intermedia (entre 130 y 250 caracteres)."}
            {difficulty === "dificil" && "Difícil: Notas extensas (más de 250 caracteres) para análisis profundo."}
          </p>
        </div>

        <p className="text-sm text-neutral-500 mb-8">
          Dataset: {quizData.length} conceptos anotados sobre {new Set(quizData.map((i) => i.caseId)).size} casos clínicos.
        </p>
        <button
          onClick={() => startGame(difficulty)}
          className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 transition-colors"
        >
          Comenzar ronda ({ROUND_SIZE} casos)
        </button>
      </div>
    );
  }

  if (phase === "done") {
    const pct = Math.round((totalScore / maxScore) * 100);
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">Resultado final</h1>
        <p className="text-lg mb-6">
          Puntaje: <span className="font-bold">{totalScore}</span> / {maxScore} ({pct}%)
        </p>

        {badges.length > 0 && (
          <div className="mb-8 p-4 border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10 rounded-xl text-center">
            <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mb-3 flex items-center gap-1.5 justify-center">
              🎖️ Logros Obtenidos en la Ronda
            </h3>
            <div className="flex flex-wrap gap-3 justify-center">
              {badges.map((b) => (
                <div key={b.title} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-indigo-200/40 bg-white dark:bg-neutral-900 text-left max-w-xs shadow-sm">
                  <span className="text-2xl">{b.emoji}</span>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{b.title}</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4 mb-8">
          {log.map((r, i) => (
            <div
              key={r.item.id}
              className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-neutral-500">Caso {i + 1}</span>
                <span
                  className={`text-sm font-semibold ${
                    r.score === 6 ? "text-emerald-600" : r.score >= 4 ? "text-amber-600" : "text-red-600"
                  }`}
                >
                  {r.score}/6
                </span>
              </div>
              <HighlightedText item={r.item} fontClass={HANDWRITING_FONTS[i % HANDWRITING_FONTS.length]} />
              <p className="text-sm mt-2 text-neutral-500">
                Correcto: {r.item.cat} · {r.item.pol} · {r.item.cert} · {r.item.temp} · {r.item.suj} ·{" "}
                <em>{r.item.term}</em> (SCTID {r.item.sctid})
              </p>
            </div>
          ))}
        </div>
        <button
          onClick={() => startGame(difficulty)}
          className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 transition-colors"
        >
          Jugar otra ronda
        </button>
      </div>
    );
  }

  if (!current) return null;

  const subjectDiscrepancia = encodeURIComponent(`Discrepancia SemantIAr Quiz - Caso ${current.caseId}`);
  const bodyDiscrepancia = encodeURIComponent(
    `Concepto ID: ${current.id}\nTérmino evaluado: ${current.literal}\n\nSugerencia: ${sugerencia}`
  );
  const mailtoDiscrepancia = `mailto:jsanchezviamonte@gmail.com?subject=${subjectDiscrepancia}&body=${bodyDiscrepancia}`;

  const subjectRegla = encodeURIComponent(`Propuesta de Regla Clínica - Caso ${current.caseId}`);
  const bodyRegla = encodeURIComponent(
    `Propuesta de regla general a partir del Concepto ${current.id} (${current.literal}):\n\n${proposedRule}`
  );
  const mailtoRegla = `mailto:jsanchezviamonte@gmail.com?subject=${subjectRegla}&body=${bodyRegla}`;

  const subjectSinonimos = encodeURIComponent(`Propuesta de Sinónimos Locales - Caso ${current.caseId}`);
  const bodySinonimos = encodeURIComponent(
    `Término SNOMED CT: ${current.term} (SCTID: ${current.sctid})\nConcepto literal en la nota: ${current.literal}\n\nSinónimos locales propuestos:\n${localSynonyms.map((s) => `- ${s}`).join("\n")}`
  );
  const mailtoSinonimos = `mailto:jsanchezviamonte@gmail.com?subject=${subjectSinonimos}&body=${bodySinonimos}`;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex justify-between items-center mb-4 text-sm text-neutral-500">
        <span>
          Caso {index + 1} / {items.length}
        </span>
        <span>Puntaje acumulado: {totalScore}</span>
      </div>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 mb-6 bg-neutral-50 dark:bg-neutral-900">
        <HighlightedText item={current} fontClass={HANDWRITING_FONTS[index % HANDWRITING_FONTS.length]} />
      </div>

      {locked && (
        <OntologyGraph item={current} answers={answers} />
      )}

      {locked && activeRules.length > 0 && (
        <div className="space-y-2 mb-6">
          {activeRules.map((rule) => (
            <div key={rule.key} className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-lg text-xs text-indigo-800 dark:text-indigo-300 animate-fadeIn">
              <strong className="block mb-1">💡 {rule.title}</strong>
              <p>{rule.desc}</p>
            </div>
          ))}
        </div>
      )}

      {locked && (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 mb-6 bg-neutral-50 dark:bg-neutral-900/60 text-xs">
          <div className="flex flex-wrap border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-3 gap-4">
            <button
              onClick={() => { setReportType("error"); setSugerido(false); }}
              className={`font-semibold pb-1 border-b-2 transition-all outline-none ${
                reportType === "error"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Reportar Discrepancia del Caso
            </button>
            <button
              onClick={() => { setReportType("rule"); setSugerido(false); }}
              className={`font-semibold pb-1 border-b-2 transition-all outline-none ${
                reportType === "rule"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Proponer Nueva Regla Clínica
            </button>
            <button
              onClick={() => { setReportType("synonyms"); setSugerido(false); }}
              className={`font-semibold pb-1 border-b-2 transition-all outline-none ${
                reportType === "synonyms"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              Sugerir Sinónimos Locales
            </button>
          </div>

          {reportType === "error" && (
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                💬 ¿Detectaste algún error o discrepancia en esta anotación?
              </p>
              <p className="text-neutral-500 dark:text-neutral-400 mb-2">
                Dado que es un ejercicio educativo, sin una curación estricta de los datos, pueden existir errores o inconsistencias. Podés reportar discrepancias o sugerir alternativas para la recalibración del juego al correo electrónico jsanchezviamonte@gmail.com.
              </p>
              <p className="text-neutral-500 dark:text-neutral-400 mb-3">
                Si quieres revisar y ampliar para ver si existe un término más preciso para lo que buscas, aquí tienes el enlace al buscador de SNOMED CT (Edición Argentina):{" "}
                <a 
                  href="https://browser.ihtsdotools.org/?edition=es-argentina-edition" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 underline font-semibold"
                >
                  https://browser.ihtsdotools.org
                </a>
              </p>
              
              {!sugerido ? (
                <div className="space-y-2">
                  <textarea
                    value={sugerencia}
                    onChange={(e) => setSugerencia(e.target.value)}
                    placeholder="Ej. El sujeto debería ser Familiar ya que la evolución refiere a la madre, o el término SNOMED CT debería ser..."
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 outline-none focus:border-indigo-500"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={!sugerencia.trim()}
                      onClick={() => setSugerido(true)}
                      className="bg-indigo-600 disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors"
                    >
                      Registrar sugerencia
                    </button>
                    <a
                      href={mailtoDiscrepancia}
                      onClick={() => setSugerido(true)}
                      className="border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold px-3 py-1.5 rounded text-xs flex items-center gap-1 text-center"
                    >
                      📧 Enviar por Mail
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded text-emerald-800 dark:text-emerald-300">
                  ✓ Sugerencia guardada temporalmente. ¡Muchas gracias por colaborar con la recalibración y mejora del juego!
                </div>
              )}
            </div>
          )}

          {reportType === "rule" && (
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                📜 Sugerir Nueva Regla de Consenso Metodológico o Criterio
              </p>
              <p className="text-neutral-500 dark:text-neutral-400 mb-3">
                Si considerás que conceptos similares en este tipo de contextos clínicos deberían modelarse bajo una regla general de consenso o que una regla activa es inadecuada para el caso planteado, ingresá tu propuesta:
              </p>
              
              {!sugerido ? (
                <div className="space-y-2">
                  <textarea
                    value={proposedRule}
                    onChange={(e) => setProposedRule(e.target.value)}
                    placeholder="Ej. Propongo que toda mención a SPO2 [Valor]% deba ser categorizada como Hallazgo Clínico y no como Procedimiento..."
                    className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 outline-none focus:border-indigo-500"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={!proposedRule.trim()}
                      onClick={() => setSugerido(true)}
                      className="bg-indigo-600 disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors"
                    >
                      Registrar propuesta
                    </button>
                    <a
                      href={mailtoRegla}
                      onClick={() => setSugerido(true)}
                      className="border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold px-3 py-1.5 rounded text-xs flex items-center gap-1 text-center"
                    >
                      📧 Proponer Regla por Mail
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded text-emerald-800 dark:text-emerald-300">
                  ✓ Propuesta de regla de consenso guardada temporalmente. ¡Muchas gracias por colaborar con la definición metodológica del juego!
                </div>
              )}
            </div>
          )}

          {reportType === "synonyms" && (
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                🏷️ Sugerir Sinónimos Locales para el término SNOMED CT
              </p>
              <p className="text-neutral-500 dark:text-neutral-400 mb-2">
                Término SNOMED CT correcto: <strong className="text-neutral-850 dark:text-neutral-150">{current.term}</strong> (SCTID: <code>{current.sctid}</code>)
              </p>
              <p className="text-neutral-500 dark:text-neutral-400 mb-3">
                Ingresá sinónimos coloquiales o expresiones locales alternativas que se utilicen habitualmente en tu ámbito clínico para este concepto. Podés agregar varios términos y enviarlos:
              </p>

              {!sugerido ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={synonymInput}
                      onChange={(e) => setSynonymInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (synonymInput.trim()) {
                            setLocalSynonyms((prev) => [...prev, synonymInput.trim()]);
                            setSynonymInput("");
                          }
                        }
                      }}
                      placeholder="Ej. respirador, tubo en T, asistencia ventilatoria..."
                      className="flex-1 p-2 border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 outline-none focus:border-indigo-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (synonymInput.trim()) {
                          setLocalSynonyms((prev) => [...prev, synonymInput.trim()]);
                          setSynonymInput("");
                        }
                      }}
                      className="bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold px-3 py-2 rounded text-xs transition-colors"
                    >
                      Agregar
                    </button>
                  </div>

                  {localSynonyms.length > 0 && (
                    <div className="bg-white dark:bg-neutral-950 p-3 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                      <p className="font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">Sinónimos enumerados a sugerir:</p>
                      <ol className="list-decimal pl-5 space-y-1 text-neutral-600 dark:text-neutral-400">
                        {localSynonyms.map((s, idx) => (
                          <li key={idx} className="flex justify-between items-center group/item">
                            <span>{s}</span>
                            <button
                              type="button"
                              onClick={() => setLocalSynonyms((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700 font-bold px-1 select-none text-xs"
                              title="Remover sinónimo"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      disabled={localSynonyms.length === 0}
                      onClick={() => setSugerido(true)}
                      className="bg-indigo-600 disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors"
                    >
                      Registrar sinónimos
                    </button>
                    <a
                      href={mailtoSinonimos}
                      onClick={() => setSugerido(true)}
                      className="border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold px-3 py-1.5 rounded text-xs flex items-center gap-1 text-center"
                    >
                      📧 Enviar Sinónimos por Mail
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded text-emerald-800 dark:text-emerald-300">
                  ✓ Propuesta de sinónimos guardada temporalmente. ¡Muchas gracias por colaborar con el diccionario local!
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-5">
        <QuestionBlock
          label="¿Qué categoría clínica corresponde al texto resaltado?"
          kind="cat"
          options={[...CATEGORIES]}
          value={answers.cat}
          correctValue={current.cat}
          locked={locked}
          onSelect={(v) => selectAnswer("cat", v)}
        />
        <QuestionBlock
          label="¿Cuál es la polaridad?"
          kind="pol"
          options={[...POLARITIES]}
          value={answers.pol}
          correctValue={current.pol}
          locked={locked}
          onSelect={(v) => selectAnswer("pol", v)}
        />
        <QuestionBlock
          label="¿Cuál es el grado de certeza?"
          kind="cert"
          options={[...CERTAINTIES]}
          value={answers.cert}
          correctValue={current.cert}
          locked={locked}
          onSelect={(v) => selectAnswer("cert", v)}
        />
        <QuestionBlock
          label="¿Cuál es la temporalidad?"
          kind="temp"
          options={[...TEMPORALITIES]}
          value={answers.temp}
          correctValue={current.temp}
          locked={locked}
          onSelect={(v) => selectAnswer("temp", v)}
        />
        <QuestionBlock
          label="¿Cuál es el sujeto de la relación?"
          kind="suj"
          options={[...SUBJECTS]}
          value={answers.suj}
          correctValue={current.suj}
          locked={locked}
          onSelect={(v) => selectAnswer("suj", v)}
        />
        <QuestionBlock
          label="¿Cuál es el término SNOMED CT correcto?"
          kind="term"
          options={termOptions}
          value={answers.term}
          correctValue={current.term}
          locked={locked}
          onSelect={(v) => selectAnswer("term", v)}
        />
      </div>

      <div className="mt-6 flex justify-end gap-3">
        {!locked ? (
          <button
            disabled={!allAnswered()}
            onClick={confirmAnswers}
            className="rounded-full bg-indigo-600 disabled:bg-neutral-300 disabled:text-neutral-500 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 transition-colors"
          >
            Confirmar respuestas
          </button>
        ) : (
          <button
            onClick={nextCase}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2.5 transition-colors"
          >
            {index + 1 >= items.length ? "Ver resultado" : "Siguiente caso"}
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionBlock({
  label,
  kind,
  options,
  value,
  correctValue,
  locked,
  onSelect,
}: {
  label: string;
  kind: QuestionKind;
  options: string[];
  value?: string;
  correctValue: string;
  locked: boolean;
  onSelect: (v: string) => void;
}) {
  const tooltip = TOOLTIP_DATA[kind];

  return (
    <div>
      <div className="flex items-center mb-2">
        <p className="font-medium">{label}</p>
        {tooltip && (
          <div className="group relative inline-block ml-2 cursor-help text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
            <span className="text-sm font-semibold select-none">❓</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all scale-95 group-hover:scale-100 z-50 whitespace-normal">
              <p className="font-bold text-neutral-100 mb-1.5 border-b border-neutral-800 pb-1 text-xs flex items-center gap-1">
                📖 {tooltip.title}
              </p>
              <ul className="space-y-1.5">
                {tooltip.defs.map((d) => (
                  <li key={d.name} className="leading-relaxed">
                    <strong className="text-indigo-400 font-bold">{d.name}:</strong> {d.desc}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt;
          let cls =
            "rounded-lg border px-3 py-2 text-sm transition-colors border-neutral-300 dark:border-neutral-700 hover:border-indigo-400";
          if (locked) {
            if (opt === correctValue) {
              cls =
                "rounded-lg border px-3 py-2 text-sm border-emerald-500 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300";
            } else if (selected) {
              cls =
                "rounded-lg border px-3 py-2 text-sm border-red-500 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300";
            } else {
              cls =
                "rounded-lg border px-3 py-2 text-sm border-neutral-200 dark:border-neutral-800 opacity-60";
            }
          } else if (selected) {
            cls =
              "rounded-lg border px-3 py-2 text-sm border-indigo-600 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300";
          }
          return (
            <button key={opt} disabled={locked} onClick={() => onSelect(opt)} className={cls}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OntologyGraph({ item, answers }: { item: QuizItem; answers: Answers }) {
  const parentTerm = item.cat === "Hallazgo clínico" 
    ? "Hallazgo clínico (SCTID: 404684003)" 
    : item.cat === "Procedimiento" 
      ? "Procedimiento (SCTID: 71388002)" 
      : "Fármaco o sustancia (SCTID: 373873005)";

  const correctCat = isCorrect(item, "cat", answers.cat || "");
  const correctPol = isCorrect(item, "pol", answers.pol || "");
  const correctCert = isCorrect(item, "cert", answers.cert || "");
  const correctTemp = isCorrect(item, "temp", answers.temp || "");
  const correctSuj = isCorrect(item, "suj", answers.suj || "");
  const correctTerm = isCorrect(item, "term", answers.term || "");

  return (
    <div className="border border-cyan-500/20 dark:border-cyan-500/35 rounded-xl p-5 mb-5 bg-neutral-950/80 shadow-md flex flex-col items-center">
      <h4 className="text-xs uppercase font-bold text-neutral-400 tracking-widest mb-3">
        Grafo Semántico de la Anotación (SNOMED CT)
      </h4>
      
      {/* Nodo Superior: Ancestro / Categoría */}
      <div className={`px-4 py-1.5 rounded-lg border text-xs font-semibold shadow ${
        correctCat 
          ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-400" 
          : "border-red-500/40 bg-red-950/30 text-red-400"
      }`}>
        {parentTerm}
      </div>
      
      {/* Línea conectiva vertical */}
      <div className="w-[2px] h-5 bg-neutral-700 dark:bg-neutral-800 relative">
        <span className="absolute -bottom-1 -left-[3px] text-[6px] text-neutral-500">▼</span>
      </div>
      
      {/* Nodo Central: Término SNOMED CT */}
      <div className={`px-4 py-2.5 rounded-xl border text-sm font-bold shadow-sm max-w-md text-center transition-all ${
        correctTerm 
          ? "border-cyan-400 bg-cyan-950/20 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.15)]" 
          : "border-red-500/60 bg-red-950/20 text-red-300"
      }`}>
        {item.term}
        <span className="block text-[10px] font-mono font-medium text-neutral-400 mt-0.5">
          SCTID: {item.sctid}
        </span>
      </div>
      
      {/* Línea conectiva vertical hacia los atributos */}
      <div className="w-[2px] h-5 bg-neutral-700 dark:bg-neutral-800 relative">
        <span className="absolute -bottom-1 -left-[3px] text-[6px] text-neutral-500">▼</span>
      </div>
      
      {/* Fila de Atributos Contextuales */}
      <div className="flex flex-wrap justify-center gap-2 mt-1">
        {/* Atributo: Polaridad */}
        <div className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
          correctPol 
            ? "border-emerald-500/30 bg-emerald-950/10 text-emerald-400" 
            : "border-red-500/30 bg-red-950/10 text-red-400"
        }`}>
          <span className="text-neutral-500 mr-1">Polaridad:</span> {item.pol}
        </div>
        
        {/* Atributo: Certeza */}
        <div className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
          correctCert 
            ? "border-emerald-500/30 bg-emerald-950/10 text-emerald-400" 
            : "border-red-500/30 bg-red-950/10 text-red-400"
        }`}>
          <span className="text-neutral-500 mr-1">Certeza:</span> {item.cert}
        </div>

        {/* Atributo: Temporalidad */}
        <div className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
          correctTemp 
            ? "border-emerald-500/30 bg-emerald-950/10 text-emerald-400" 
            : "border-red-500/30 bg-red-950/10 text-red-400"
        }`}>
          <span className="text-neutral-500 mr-1">Temporalidad:</span> {item.temp}
        </div>

        {/* Atributo: Sujeto */}
        <div className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
          correctSuj 
            ? "border-emerald-500/30 bg-emerald-950/10 text-emerald-400" 
            : "border-red-500/30 bg-red-950/10 text-red-400"
        }`}>
          <span className="text-neutral-500 mr-1">Sujeto:</span> {item.suj}
        </div>
      </div>
      
      {/* Mensaje Informativo */}
      <div className="mt-4 text-center text-[10px] text-neutral-400 max-w-lg border-t border-neutral-800 pt-2 w-full">
        {correctTerm && correctCat && correctPol && correctCert && correctTemp && correctSuj ? (
          <span className="text-emerald-400 font-semibold">¡Anotación clínica perfecta! Todos los atributos y el código SNOMED CT están calibrados.</span>
        ) : (
          <span>Discrepancias en rojo. Ajuste los atributos para alinearse con la calibración del corpus.</span>
        )}
      </div>
    </div>
  );
}

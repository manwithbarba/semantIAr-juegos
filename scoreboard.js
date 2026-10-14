/* Local scores only; no clinical data or player identifiers. */
const Scoreboard = (() => {
  const KEY = "semantiar_retro_scoreboard_v1";
  const OLD = "semantiar_retro_educational_stats_v3";
  let memory = null;
  let persistent = true;
  function empty() { return {version:1, roundsPlayed:0,totalScore:0,maxScore:0,bestScore:0,bestStreak:0,history:[]}; }
  function validEntry(e) {
    return e && typeof e.id === "string" && e.id.length < 100 &&
      ["semantic","lexical","audit"].includes(e.mode) &&
      ["all","facil","normal","dificil"].includes(e.difficulty) &&
      typeof e.timer === "boolean" && Number.isInteger(e.cases) && e.cases > 0 && e.cases <= 24 &&
      Number.isInteger(e.score) && Number.isInteger(e.maxScore) && e.score >= 0 &&
      e.maxScore === e.cases * ({semantic:6,lexical:4,audit:3}[e.mode]) && e.score <= e.maxScore &&
      Number.isInteger(e.hints) && e.hints >= 0 && e.hints <= e.cases;
  }
  function clean(raw) {
    const v = empty();
    for (const k of ["roundsPlayed","totalScore","maxScore","bestScore","bestStreak"])
      v[k] = Number.isSafeInteger(raw?.[k]) && raw[k] >= 0 ? raw[k] : 0;
    v.totalScore = Math.min(v.totalScore,v.maxScore);
    v.history = Array.isArray(raw?.history) ? raw.history.filter(validEntry).slice(-200) : [];
    return v;
  }
  function load() {
    if (memory) return memory;
    try { memory = clean(JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD) || "{}")); }
    catch { memory = empty(); persistent = false; }
    return memory;
  }
  function write(v) {
    memory = v;
    try { localStorage.setItem(KEY,JSON.stringify(v)); persistent = true; }
    catch { persistent = false; }
    return v;
  }
  function record(entry,streak) {
    const old = load();
    if (!validEntry(entry) || old.history.some(e => e.id === entry.id)) return old;
    return write({...old, roundsPlayed:old.roundsPlayed+1,totalScore:old.totalScore+entry.score,
      maxScore:old.maxScore+entry.maxScore,bestScore:Math.max(old.bestScore,entry.score),
      bestStreak:Math.max(old.bestStreak,streak),
      history:[...old.history,entry].slice(-200)});
  }
  function matches(e,c) {
    return e.mode === c.mode && e.difficulty === c.difficulty && e.timer === c.timer &&
      e.cases === c.cases && e.hints === c.hints;
  }
  function rank(config) {
    return load().history.filter(e => matches(e,config)).sort((a,b) => b.score-a.score).slice(0,10);
  }
  function reset() { return write(empty()); }
  return {load,record,rank,reset,isPersistent:()=>persistent};
})();


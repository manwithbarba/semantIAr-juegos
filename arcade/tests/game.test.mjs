import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base = new URL('../',import.meta.url);
const scoreSource = fs.readFileSync(new URL('scoreboard.js',base),'utf8');
const gameSource = fs.readFileSync(new URL('game.js',base),'utf8');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
function fixture({stored={},blocked=false}={}) {
  const data = new Map(Object.entries(stored));
  const nodes = new Map();
  const node = id => {
    if(!nodes.has(id)) nodes.set(id,{textContent:'',innerHTML:'',hidden:false,disabled:false,
      classList:{toggle(){},add(){},remove(){},contains(){return false;}},
      setAttribute(){},querySelector(){return null;},focus(){}});
    return nodes.get(id);
  };
  let timer;
  const listeners = {};
  const context = vm.createContext({
    console,crypto:{randomUUID:()=>String(Math.random())},Date,Math,
    localStorage:{getItem(k){if(blocked)throw Error('denied');return data.get(k)||null;},
      setItem(k,v){if(blocked)throw Error('quota');data.set(k,v);},removeItem(k){data.delete(k);}},
    document:{body:{dataset:{}},hidden:false,getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    window:{addEventListener(name,fn){listeners[name]=fn;}},matchMedia:()=>({matches:false}),
    setInterval(fn){timer=fn;return 1;},clearInterval(){timer=null;},setTimeout,clearTimeout
  });
  vm.runInContext(scoreSource,context);
  vm.runInContext(gameSource,context);
  return {run:s=>vm.runInContext(s,context),data,nodes,listeners,tick:()=>timer?.()};
}
const entry = {id:'one',mode:'semantic',difficulty:'all',timer:false,cases:5,score:23,maxScore:30,hints:0};
test('Scoreboard: guardado, recarga y deduplicación',()=>{
  const f=fixture();f.run('Scoreboard.record('+JSON.stringify(entry)+',2)');
  f.run('Scoreboard.record('+JSON.stringify(entry)+',2)');
  assert.equal(f.run('Scoreboard.load().roundsPlayed'),1);
  const reload=fixture({stored:Object.fromEntries(f.data)});
  assert.equal(reload.run('Scoreboard.load().history[0].score'),23);
});
test('Clasificación separa modo, dificultad, cantidad, reloj y pistas',()=>{
  const f=fixture();f.run('Scoreboard.record('+JSON.stringify(entry)+',2)');
  for(const patch of [{mode:'lexical'},{difficulty:'facil'},{timer:true},{cases:10},{hints:1}])
    assert.equal(f.run('Scoreboard.rank('+JSON.stringify({...entry,...patch})+').length'),0);
});
test('JSON corrupto y almacenamiento denegado no detienen el juego',()=>{
  for(const f of [fixture({stored:{semantiar_retro_scoreboard_v1:'{bad'}}),fixture({blocked:true})]){
    f.run('Scoreboard.record('+JSON.stringify(entry)+',2)');
    assert.equal(f.run('Scoreboard.load().roundsPlayed'),1);
  }
});
test('Migración del historial agregado v3',()=>{
  const f=fixture({stored:{semantiar_retro_educational_stats_v3:JSON.stringify({roundsPlayed:3,totalScore:10,maxScore:30,bestScore:8,bestStreak:2})}});
  assert.equal(f.run('Scoreboard.load().roundsPlayed'),3);
  assert.equal(f.run('Scoreboard.load().history.length'),0);
});
test('Validación rechaza puntaje imposible y limita historial a 200',()=>{
  const f=fixture();
  f.run('Scoreboard.record('+JSON.stringify({...entry,score:999})+',2)');
  assert.equal(f.run('Scoreboard.load().roundsPlayed'),0);
  for(let i=0;i<205;i++)f.run('Scoreboard.record('+JSON.stringify({...entry,id:String(i)})+',2)');
  assert.equal(f.run('Scoreboard.load().history.length'),200);
  f.run('Scoreboard.reset()'); assert.equal(f.run('Scoreboard.load().roundsPlayed'),0);
});
for (const [mode,keys,max] of [
  ['semantic',['cat','pol','cert','temp','suj','sctid'],30],
  ['lexical',['formType','function','section','expansion'],20],
  ['audit',['mappingAction','auditFlag','validatedSense'],15]]) {
  test('Partida completa '+mode+': puntaje, idempotencia y récord',()=>{
    const f=fixture();
    f.run('selectGameMode("'+mode+'");setRoundLength(5);startNewRound();');
    for(let i=0;i<5;i++){
      f.run('for(const k of '+JSON.stringify(keys)+') selectAnswer(k,gameState.roundItems[gameState.currentIndex][k]);confirmCurrentAnswers();confirmCurrentAnswers();nextQuestion();');
    }
    assert.equal(f.run('gameState.roundScore'),max);
    assert.equal(f.run('gameState.history.length'),5);
    assert.equal(f.run('Scoreboard.load().roundsPlayed'),1);
    f.run('saveStats(gameState.roundScore,gameState.roundMaxScore,gameState.bestRoundStreak)');
    assert.equal(f.run('Scoreboard.load().roundsPlayed'),1);
    assert.equal(f.nodes.get('hudBest').textContent,max+' / '+max);
  });
}
test('Reloj conserva tiempo al cambiar de vista y confirmar incompleto',()=>{
  const f=fixture();f.run('toggleTimerMode();startNewRound()');
  f.tick();assert.equal(f.run('gameState.timeLeft'),44);
  f.run('confirmCurrentAnswers()');f.tick();assert.equal(f.run('gameState.timeLeft'),43);
  f.run('switchView("menu");switchView("play")');assert.equal(f.run('gameState.timeLeft'),43);
  f.run('document.hidden=true');f.tick();assert.equal(f.run('gameState.timeLeft'),43);
});
test('Timeout puntúa una sola vez y la pista se cuenta una vez por caso',()=>{
  const f=fixture();f.run('toggleTimerMode();startNewRound();triggerHint();triggerHint();');
  assert.equal(f.run('gameState.hints'),1);
  for(let i=0;i<45;i++)f.tick();
  assert.equal(f.run('gameState.history.length'),1);assert.equal(f.run('gameState.roundScore'),0);
  f.run('confirmCurrentAnswers(true)');assert.equal(f.run('gameState.history.length'),1);
});
test('Una selección no reconstruye la pregunta',()=>{
  const f=fixture();f.run('startNewRound()');const before=f.nodes.get('playContainer').innerHTML;
  f.run('selectAnswer("pol","Activo")');assert.equal(f.nodes.get('playContainer').innerHTML,before);
});
test('Fecha removida de las etiquetas y código de interfaz',()=>{
  assert(!fs.readFileSync(new URL('index.html',base),'utf8').includes('29/09/2026'));
  assert(!gameSource.includes('29/09/2026'));
});
test('Marcador móvil actualiza puntaje, progreso y visibilidad',()=>{
  const f=fixture();f.run('setRoundLength(5);startNewRound()');
  assert.equal(f.nodes.get('mobileScore').hidden,false);
  assert(f.nodes.get('mobileScore').textContent.includes('Caso 1/5'));
  f.run('confirmCurrentAnswers(true)');
  assert(f.nodes.get('mobileScore').textContent.includes('Puntos: 0'));
  f.run('switchView("menu")');
  assert.equal(f.nodes.get('mobileScore').hidden,true);
});
test('Enter sobre botón respeta la activación nativa',()=>{
  const f=fixture();let prevented=false;
  f.listeners.keydown({key:'Enter',target:{tagName:'BUTTON',closest:()=>({})},preventDefault(){prevented=true;}});
  assert.equal(prevented,false);
  assert.equal(f.run('gameState.roundItems.length'),0);
});
test('Atajos no se repiten mientras se mantiene una tecla',()=>{
  const f=fixture();
  f.listeners.keydown({key:'Enter',repeat:true,target:{tagName:'BODY'},preventDefault(){throw Error('no debe actuar');}});
  assert.equal(f.run('gameState.roundItems.length'),0);
});
console.log(passed+' pruebas aprobadas');


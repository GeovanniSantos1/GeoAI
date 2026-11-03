import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyProfile,applyProfile} from '../lib/gym.ts';
import {isCatalogId,exerciseOf} from '../lib/gym-catalog.ts';
import {starterPlan,buildActive} from '../lib/gym-plan.ts';
import {heatmap,seriesOf,frequentExercises,doneByMuscle,plannedByMuscle,effortSummary,recordTimeline,bestWeekStreak,SET_RANGE} from '../lib/gym-insights.ts';
import {platesFor,warmupRamp,LB_PLATES} from '../lib/gym-plates.ts';
import {workoutsCsv,gymJson,CSV_HEADER} from '../lib/gym-export.ts';
import {levelOfExercises,levelFrom,MUSCLE_SLUGS,SLUG_MUSCLE} from '../lib/gym-muscles.ts';
import {BODY} from '../lib/gym-body-paths.ts';

const TODAY='2026-11-03',BENCH='Barbell_Bench_Press_-_Medium_Grip';let n=0;const id=()=>'z'+(++n);
const set=(weight,reps,extra={})=>({id:id(),kind:'work',weight,reps,timeSec:null,effort:null,done:true,doneAt:'2026-10-01T10:00:00.000Z',...extra});
const w=(date,exerciseId,sets,extra={})=>({id:'w'+date+exerciseId.slice(0,5),routineId:null,name:'T',date,startedAt:date+'T10:00:00.000Z',durationMin:50,notes:'',noProgression:false,exercises:[{exerciseId,notes:'',sets}],prs:0,rev:1,...extra});
const ctx={known:isCatalogId,today:TODAY,starter:starterPlan};

test('atividade do ano: 52 semanas de 7 dias até hoje, com minutos e volume',()=>{
 const h=heatmap([w('2026-11-02',BENCH,[set(100,5)]),w('2026-11-02','Barbell_Squat',[set(100,5)],{id:'b'})],TODAY);
 assert.equal(h.cols.length,52);assert.ok(h.cols.every(c=>c.length===7));const last=h.cols[51];assert.equal(last[0].date,'2026-11-02');assert.equal(last[0].count,2);assert.equal(last[0].volume,1000);assert.equal(last[2].future,true);assert.equal(h.max.minutes,100);});

test('evolução de um exercício: série mais pesada, 1RM e volume por treino, em ordem',()=>{
 const s=seriesOf([w('2026-10-30',BENCH,[set(80,5),set(85,3,{effort:1})]),w('2026-10-20',BENCH,[set(40,10,{kind:'warmup'}),set(75,5)])],BENCH);
 assert.deepEqual(s.map(p=>p.date),['2026-10-20','2026-10-30']);assert.equal(s[1].top,85);assert.equal(s[1].reps,3);assert.equal(s[1].effort,1);assert.equal(s[1].e1rm,93.5);assert.equal(s[0].volume,375,'aquecimento fora');
 assert.deepEqual(frequentExercises([w('2026-10-30',BENCH,[set(80,5)]),w('2026-10-20',BENCH,[set(75,5)]),w('2026-10-21','Barbell_Squat',[set(75,5)])])[0],{id:BENCH,count:2});});

test('séries por músculo: feitas por semana e planejadas pela agenda',()=>{
 const done=doneByMuscle([w('2026-10-30',BENCH,[set(80,5),set(80,5)])],'2026-10-06',TODAY);assert.equal(done.chest,0.5,'2 séries em 4 semanas');assert.equal(done.triceps,0.3);
 const p=applyProfile(emptyProfile(),{type:'starter',key:'ppl',seed:'i'},ctx);const plan=plannedByMuscle(p);assert.ok(plan.chest>=7,String(plan.chest));assert.ok(plan.quadriceps>0);
 const rot=plannedByMuscle(applyProfile(p,{type:'schedule',schedule:{mode:'rotation'}},ctx));assert.ok(rot.chest>0);assert.deepEqual(SET_RANGE,[10,20]);});

test('esforço: média, parte perto da falha e distribuição só com séries avaliadas',()=>{
 const e=effortSummary([w('2026-10-30',BENCH,[set(80,5,{effort:0}),set(80,5,{effort:2}),set(80,5,{effort:4}),set(80,5)])],'2026-10-01');
 assert.equal(e.rated,3);assert.equal(e.total,4);assert.equal(e.avg,2);assert.equal(e.hard,67);assert.deepEqual(e.buckets.map(b=>b[1]),[1,0,1,0,1]);
 assert.equal(effortSummary([],'2026-10-01').avg,null);});

test('linha do tempo de recordes: a primeira sessão é a base, depois cada marca superada',()=>{
 const t=recordTimeline([w('2026-10-01',BENCH,[set(80,5)]),w('2026-10-08',BENCH,[set(85,5)]),w('2026-10-15',BENCH,[set(80,5)]),w('2026-10-22',BENCH,[set(85,6)]),w('2026-10-01','Plank',[set(null,null,{timeSec:30})]),w('2026-10-09','Plank',[set(null,null,{timeSec:45})])]);
 assert.deepEqual(t.map(r=>r.date+' '+r.exerciseId.slice(0,5)),['2026-10-22 Barbe','2026-10-09 Plank','2026-10-08 Barbe']);
 assert.equal(bestWeekStreak(['2026-10-05','2026-10-12','2026-10-19','2026-11-02']),3);});

test('anilhas: por lado, com o total que dá para montar; aquecimento em rampa',()=>{
 assert.deepEqual(platesFor(100,20),{perSide:[25,15],achieved:100,exact:true});
 assert.deepEqual(platesFor(61.25,20),{perSide:[20],achieved:60,exact:false},'0,625 por lado não fecha com anilha de 1,25');
 const odd=platesFor(63,20);assert.equal(odd.exact,false);assert.ok(odd.achieved<=63);assert.equal(platesFor(20,20).perSide.length,0);assert.equal(platesFor(0,20),null);
 assert.equal(platesFor(225*0.45359237,45*0.45359237,LB_PLATES).perSide.length,2,'225 lb = 2 de 45 por lado');
 assert.deepEqual(warmupRamp(100,20,2.5),[{weight:20,reps:10},{weight:40,reps:5},{weight:60,reps:3},{weight:80,reps:2}]);assert.deepEqual(warmupRamp(25,20,2.5),[]);
 const p=applyProfile(applyProfile(emptyProfile(),{type:'routine',routine:{id:'r',name:'S',items:[{id:'a',exerciseId:'Barbell_Squat',sets:3,reps:5,weight:100}]}},ctx),{type:'settings',settings:{warmups:true}},ctx);
 const a=buildActive(p,[],p.routines[0],{id:'q',date:TODAY,at:new Date(),newId:id});assert.deepEqual(a.exercises[0].sets.map(s=>s.kind),['warmup','warmup','warmup','warmup','work','work','work']);
 assert.throws(()=>applyProfile(p,{type:'settings',settings:{bar:80}},ctx),/barra/);});

test('exportar: CSV com uma linha por série (aspas quando precisa) e JSON com perfil e treinos',()=>{
 const p=emptyProfile();const csv=workoutsCsv([w('2026-10-30',BENCH,[set(80,5,{effort:2})],{name:'Peito, "pesado"'})],p);const lines=csv.trim().split('\n');
 assert.equal(lines[0],CSV_HEADER.join(','));assert.equal(lines.length,2);assert.ok(lines[1].includes('"Peito, ""pesado"""'));assert.ok(lines[1].includes('Supino reto com barra'));
 const j=JSON.parse(gymJson([],p,new Date('2026-11-03T10:00:00Z')));assert.equal(j.version,1);assert.deepEqual(j.profile,p);});

test('mapa de músculos: todo músculo do catálogo tem contorno nas quatro vistas',()=>{
 for(const [m,slugs] of Object.entries(MUSCLE_SLUGS))for(const [slug] of slugs){const views=Object.values(BODY).filter(v=>v.parts[slug]);assert.ok(views.length>=1,m+' → '+slug);}
 for(const slug of Object.keys(SLUG_MUSCLE))assert.ok(Object.values(BODY).some(v=>v.parts[slug]),slug);
 const lv=levelOfExercises([{exercise:exerciseOf(BENCH),sets:4}]);assert.equal(lv.chest,1);assert.ok(lv.triceps>0&&lv.triceps<1);assert.deepEqual(levelFrom({}),{});});

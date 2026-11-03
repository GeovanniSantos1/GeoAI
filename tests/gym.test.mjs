import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyProfile,applyProfile,readProfile,toUnit,fromUnit,weekdayOf} from '../lib/gym.ts';
import {EXERCISES,isCatalogId,searchExercises,exerciseOf,defaultIncrement} from '../lib/gym-catalog.ts';
import {applyActive,finishWorkout,cleanActive,cleanWorkout,volumeOf,restLeft,REST_PRESETS} from '../lib/gym-active.ts';
import {e1rm,sessionsOf,bestSet,recordsIn,weekStreak,totals} from '../lib/gym-stats.ts';
import {nextTarget,stalls} from '../lib/gym-progression.ts';
import {starterPlan,STARTERS,todayOf,weekOf,buildActive,rotationNext,looseExercise} from '../lib/gym-plan.ts';

const TODAY='2026-11-03';// terça
let n=0;const id=()=>'x'+(++n);
const ctx={known:isCatalogId,today:TODAY,starter:starterPlan};
const at=(min=0)=>new Date(Date.UTC(2026,10,3,13,min));
const routine=(over={})=>({id:'r1',name:'Peito',icon:'push',progression:'linear',deload:false,items:[{id:'i1',exerciseId:'Barbell_Bench_Press_-_Medium_Grip',sets:3,reps:5},{id:'i2',exerciseId:'Plank',sets:2,reps:1,timeSec:30}],...over});
const set=(weight,reps,extra={})=>({id:id(),kind:'work',weight,reps,timeSec:null,effort:null,done:true,doneAt:'2026-10-01T10:00:00.000Z',...extra});
const workout=(date,exerciseId,sets,extra={})=>({id:'w'+date+exerciseId.slice(0,4),routineId:null,name:'T',date,startedAt:date+'T10:00:00.000Z',durationMin:50,notes:'',noProgression:false,exercises:[{exerciseId,notes:'',sets}],prs:0,rev:1,...extra});
const BENCH='Barbell_Bench_Press_-_Medium_Grip';

test('catálogo: 876 exercícios com nome e passos em pt-BR, ids únicos e busca sem acento',()=>{
 assert.equal(EXERCISES.length,876);assert.equal(new Set(EXERCISES.map(e=>e.id)).size,876);assert.equal(new Set(EXERCISES.map(e=>e.name.toLowerCase())).size,876);
 for(const e of EXERCISES){assert.ok(e.name&&e.steps.length>=1,e.id);assert.ok(!/—/.test(e.steps.join(' ')),e.id);}
 assert.equal(exerciseOf(BENCH).name,'Supino reto com barra');
 const r=searchExercises(EXERCISES,{query:'supino halter'});assert.ok(r.length>0&&r.every(e=>/supino/i.test(e.name)),r.map(e=>e.name).join());
 assert.ok(searchExercises(EXERCISES,{query:'triceps'}).length>5,'sem acento acha Tríceps');
 assert.ok(searchExercises(EXERCISES,{part:'peito',equipment:'dumbbell'}).every(e=>e.primary.includes('chest')&&e.equipment==='dumbbell'));
 assert.ok(searchExercises(EXERCISES,{part:'alongamento'}).every(e=>e.category==='stretching'));
 assert.equal(exerciseOf('Plank').timed,true);assert.equal(defaultIncrement(exerciseOf(BENCH)),2.5);assert.equal(defaultIncrement(exerciseOf('Barbell_Squat')),5);assert.equal(defaultIncrement(exerciseOf('Pushups')),0);});

test('perfil: rotina valida limites e exercícios, excluir limpa agenda e rotação',()=>{
 let p=applyProfile(emptyProfile(),{type:'routine',routine:routine()},ctx);assert.equal(p.routines[0].items.length,2);assert.equal(p.routines[0].items[0].sets,3);
 assert.throws(()=>applyProfile(p,{type:'routine',routine:routine({items:[{id:'a',exerciseId:'Nao_Existe',sets:3,reps:5}]})},ctx),/desconhecido/);
 assert.throws(()=>applyProfile(p,{type:'routine',routine:routine({items:[{id:'a',exerciseId:BENCH,sets:30,reps:5}]})},ctx),/Séries/);
 assert.throws(()=>applyProfile(p,{type:'routine',routine:routine({items:[{id:'a',exerciseId:BENCH,sets:3,reps:10,repMax:8}]})},ctx),/faixa/);
 assert.throws(()=>applyProfile(p,{type:'routine',routine:routine({name:'  '})},ctx),/obrigatório/);
 p=applyProfile(p,{type:'schedule',schedule:{days:{mon:'r1',thu:'r1',fri:'zzz'},rotation:['r1','zzz']}},ctx);assert.equal(p.schedule.days.mon,'r1');assert.equal(p.schedule.days.fri,null);assert.deepEqual(p.schedule.rotation,['r1']);
 p=applyProfile(p,{type:'move',date:TODAY,routineId:'r1'},ctx);assert.equal(p.schedule.moved[TODAY],'r1');
 p=applyProfile(p,{type:'deleteRoutine',id:'r1'},ctx);assert.equal(p.routines.length,0);assert.equal(p.schedule.days.mon,null);assert.deepEqual(p.schedule.rotation,[]);assert.equal(TODAY in p.schedule.moved,false);});

test('perfil: plano inicial cria rotinas válidas e preenche a semana; ajustes e favoritos',()=>{
 for(const s of STARTERS){const p=applyProfile(emptyProfile(),{type:'starter',key:s.key,seed:'abc'},ctx);assert.equal(p.routines.length,s.routines.length,s.key);assert.ok(Object.values(p.schedule.days).filter(Boolean).length===s.days,s.key);}
 const p=applyProfile(emptyProfile(),{type:'starter',key:'ppl',seed:'s1'},ctx);const again=applyProfile(p,{type:'starter',key:'ppl',seed:'s2'},ctx);assert.equal(again.routines.length,6);assert.equal(new Set(again.routines.map(r=>r.id)).size,6);
 const timed=applyProfile(emptyProfile(),{type:'starter',key:'upperLower',seed:'s'},ctx).routines[3].items.find(i=>i.exerciseId==='Plank');assert.equal(timed.timeSec,30);
 let q=applyProfile(p,{type:'settings',settings:{unit:'lb',restSec:120,effort:'rpe'}},ctx);assert.deepEqual([q.settings.unit,q.settings.restSec,q.settings.effort],['lb',120,'rpe']);
 assert.throws(()=>applyProfile(q,{type:'settings',settings:{restSec:5000}},ctx),/Descanso/);
 q=applyProfile(q,{type:'favorite',exerciseId:BENCH,on:true},ctx);assert.deepEqual(q.favorites,[BENCH]);q=applyProfile(q,{type:'favorite',exerciseId:BENCH,on:false},ctx);assert.deepEqual(q.favorites,[]);
 q=applyProfile(q,{type:'custom',exercise:{id:'c-1',name:'Remada no aparelho da minha academia',equipment:'machine',primary:['lats'],secondary:['biceps']}},ctx);
 q=applyProfile(q,{type:'routine',routine:routine({id:'r9',items:[{id:'z',exerciseId:'c-1',sets:3,reps:10}]})},ctx);
 assert.throws(()=>applyProfile(q,{type:'deleteCustom',id:'c-1'},ctx),/rotina/);
 assert.deepEqual(readProfile(JSON.parse(JSON.stringify(q))),q,'o documento gravado é lido de volta igual');
 assert.deepEqual(readProfile({routines:[{bad:true}],settings:'x'}).routines,[],'documento estragado não derruba o Gym');});

test('unidades: kg por dentro, lb na tela',()=>{assert.equal(toUnit(100,'lb'),220.5);assert.equal(fromUnit(225,'lb'),102.06);assert.equal(toUnit(102.06,'lb'),225);assert.equal(weekdayOf(TODAY),'tue');});

test('progressão linear: sobe com todas as reps, repete quando falta, deload após 3 treinos travado',()=>{
 const item={sets:3,reps:5,repMax:null,timeSec:null,weight:null};
 assert.match(nextTarget(item,'linear',[],2.5).why,/Primeiro treino/);
 const ok=sessionsOf([workout('2026-10-30',BENCH,[set(80,5),set(80,5),set(80,5)])],BENCH);
 assert.equal(nextTarget(item,'linear',ok,2.5).weight,82.5);
 const miss=sessionsOf([workout('2026-10-30',BENCH,[set(80,5),set(80,4),set(80,3)])],BENCH);const t=nextTarget(item,'linear',miss,2.5);assert.equal(t.weight,80);assert.match(t.why,/Faltaram/);
 const three=sessionsOf(['2026-10-26','2026-10-28','2026-10-30'].map(d=>workout(d,BENCH,[set(80,5),set(80,4),set(80,3)])),BENCH);
 assert.equal(stalls(three,5,3,null),3);const d=nextTarget(item,'linear',three,2.5);assert.equal(d.weight,72.5);assert.equal(d.deload,true);
 const warm=sessionsOf([workout('2026-10-30',BENCH,[set(40,10,{kind:'warmup'}),set(80,5),set(80,5),set(80,5)])],BENCH);assert.equal(nextTarget(item,'linear',warm,2.5).weight,82.5,'aquecimento não conta');
 const skip=sessionsOf([workout('2026-10-31',BENCH,[set(50,5)],{noProgression:true}),workout('2026-10-30',BENCH,[set(80,5),set(80,5),set(80,5)])],BENCH);assert.equal(nextTarget(item,'linear',skip,2.5).weight,82.5,'treino que não conta é ignorado');});

test('progressão dupla, tripla, greyskull e por tempo',()=>{
 const item={sets:3,reps:8,repMax:12,timeSec:null,weight:null};
 const mid=sessionsOf([workout('2026-10-30',BENCH,[set(60,10),set(60,9),set(60,8)])],BENCH);const t=nextTarget(item,'double',mid,2.5);assert.deepEqual([t.weight,t.reps],[60,9]);
 const top=sessionsOf([workout('2026-10-30',BENCH,[set(60,12),set(60,12),set(60,12)])],BENCH);const u=nextTarget(item,'double',top,2.5);assert.deepEqual([u.weight,u.reps],[62.5,8]);
 const tri=nextTarget({sets:3,reps:8,repMax:12,timeSec:null,weight:null},'triple',top,2.5);assert.deepEqual([tri.sets,tri.reps,tri.weight],[4,8,60]);
 const gs=sessionsOf([workout('2026-10-30',BENCH,[set(60,5),set(60,5),set(60,11)])],BENCH);assert.equal(nextTarget({sets:3,reps:5,repMax:null,timeSec:null,weight:null},'greyskull',gs,2.5).weight,65);
 const gsMiss=sessionsOf([workout('2026-10-30',BENCH,[set(60,5),set(60,4),set(60,3)])],BENCH);assert.equal(nextTarget({sets:3,reps:5,repMax:null,timeSec:null,weight:null},'greyskull',gsMiss,2.5).weight,55);
 const plank=sessionsOf([workout('2026-10-30','Plank',[set(null,null,{timeSec:30}),set(null,null,{timeSec:35})])],'Plank');assert.equal(nextTarget({sets:2,reps:1,repMax:null,timeSec:30,weight:null},'time',plank,0).timeSec,35);});

test('treino ativo: marcar série inicia o descanso, que pausa, soma e pula; recarregar não perde o tempo',()=>{
 let p=applyProfile(emptyProfile(),{type:'routine',routine:routine()},ctx);const r=p.routines[0];
 let a=buildActive(p,[],r,{id:'act1',date:TODAY,at:at(),newId:id});assert.equal(a.exercises.length,2);assert.equal(a.exercises[0].sets.length,3);assert.equal(a.exercises[1].sets[0].timeSec,30);
 const ex=a.exercises[0],s0=ex.sets[0];
 a=applyActive(a,{type:'set',exId:ex.id,setId:s0.id,field:'weight',value:60},at(1),isCatalogId);
 a=applyActive(a,{type:'done',exId:ex.id,setId:s0.id,done:true},at(1),isCatalogId);assert.equal(a.exercises[0].sets[0].done,true);assert.equal(restLeft(a.rest,at(1).getTime()),90);
 assert.equal(restLeft(a.rest,at(1).getTime()+30000),60,'conta pelo relógio, não por um timer da tela');
 a=applyActive(a,{type:'rest',action:'pause'},new Date(at(1).getTime()+30000),isCatalogId);assert.equal(a.rest.pausedLeft,60);
 a=applyActive(a,{type:'rest',action:'add',sec:15},at(5),isCatalogId);assert.equal(a.rest.pausedLeft,75);
 a=applyActive(a,{type:'rest',action:'resume'},at(6),isCatalogId);assert.equal(restLeft(a.rest,at(6).getTime()),75);
 a=applyActive(a,{type:'rest',action:'skip'},at(6),isCatalogId);assert.equal(a.rest,null);
 assert.deepEqual(cleanActive(JSON.parse(JSON.stringify(a)),isCatalogId),a,'o servidor aceita o que o aparelho montou');
 assert.throws(()=>applyActive(a,{type:'set',exId:ex.id,setId:s0.id,field:'weight',value:5000},at(7),isCatalogId),/Peso/);
 a=applyActive(a,{type:'addSet',exId:ex.id,setId:'novo'},at(7),isCatalogId);assert.equal(a.exercises[0].sets.length,4);assert.equal(a.exercises[0].sets[3].weight,a.exercises[0].sets[2].weight);
 a=applyActive(a,{type:'swap',exId:ex.id,exerciseId:'Dumbbell_Bench_Press',weight:24},at(8),isCatalogId);assert.equal(a.exercises[0].exerciseId,'Dumbbell_Bench_Press');assert.equal(a.exercises[0].sets[0].weight,60,'série feita fica');assert.equal(a.exercises[0].sets[1].weight,24);
 const w=finishWorkout(a,at(48),1);assert.equal(w.id,'act1');assert.equal(w.durationMin,48);assert.equal(w.exercises.length,1);assert.equal(w.exercises[0].sets.length,1,'só séries feitas');assert.equal(volumeOf(w),60*5);
 assert.throws(()=>finishWorkout(buildActive(p,[],r,{id:'a2',date:TODAY,at:at(),newId:id}),at(5)),/Nenhuma série/);});

test('treino ativo: superset alterna exercícios sem descanso e descansa depois do grupo',()=>{
 const p=applyProfile(emptyProfile(),{type:'routine',routine:routine({items:[{id:'a',exerciseId:BENCH,sets:2,reps:5},{id:'b',exerciseId:'Bent_Over_Barbell_Row',sets:2,reps:5,superset:true},{id:'c',exerciseId:'Barbell_Curl',sets:1,reps:10}]})},ctx);
 let a=buildActive(p,[],p.routines[0],{id:'s',date:TODAY,at:at(),newId:id});const [A,B]=a.exercises;
 a=applyActive(a,{type:'done',exId:A.id,setId:A.sets[0].id,done:true},at(1),isCatalogId);assert.equal(a.rest,null);assert.equal(a.cursor,1);
 a=applyActive(a,{type:'done',exId:B.id,setId:B.sets[0].id,done:true},at(2),isCatalogId);assert.ok(a.rest);assert.equal(a.cursor,0,'volta ao início do grupo');
 a=applyActive(a,{type:'done',exId:A.id,setId:A.sets[1].id,done:true},at(4),isCatalogId);a=applyActive(a,{type:'done',exId:B.id,setId:B.sets[1].id,done:true},at(5),isCatalogId);assert.equal(a.cursor,2,'grupo terminado, segue para o próximo');});

test('recordes, melhor série, 1RM e sequência semanal',()=>{
 assert.equal(e1rm(100,1),100);assert.equal(e1rm(100,5),116.7);assert.equal(e1rm(100,40),0);
 const hist=[workout('2026-10-20',BENCH,[set(80,5)]),workout('2026-10-27',BENCH,[set(85,3)])];
 assert.equal(bestSet(hist,BENCH).weight,85);
 const now=workout(TODAY,BENCH,[set(85,4)]);assert.deepEqual(recordsIn(now,hist),[BENCH],'85×4 bate 85×3');
 assert.deepEqual(recordsIn(workout(TODAY,BENCH,[set(70,5)]),hist),[]);
 assert.deepEqual(recordsIn(workout(TODAY,'Barbell_Squat',[set(100,5)]),hist),[],'primeira vez não é recorde');
 assert.equal(weekStreak(['2026-11-02','2026-10-28','2026-10-21','2026-10-05'],TODAY),3);assert.equal(weekStreak(['2026-10-28','2026-10-21'],TODAY),2,'semana atual ainda sem treino não quebra');
 assert.equal(totals(hist,'2026-10-31').month,2);});

test('plano: treino de hoje na semana fixa, descanso aponta o próximo, rotação segue a fila',()=>{
 let p=applyProfile(emptyProfile(),{type:'starter',key:'ppl',seed:'q'},ctx);// seg, qua, sex
 const t=todayOf(p,[],TODAY);assert.equal(t.kind,'rest');assert.equal(t.next.date,'2026-11-04');assert.equal(t.next.routine.name,'Puxar');
 p=applyProfile(p,{type:'move',date:TODAY,routineId:p.routines[2].id},ctx);const m=todayOf(p,[],TODAY);assert.equal(m.kind,'routine');assert.equal(m.moved,true);assert.equal(m.routine.name,'Pernas');
 const week=weekOf(p,[workout('2026-11-02',BENCH,[set(80,5)])],TODAY);assert.equal(week[0].status,'done');assert.equal(week[1].status,'planned');assert.equal(week[1].today,true);assert.equal(week[2].routine.name,'Puxar');
 p=applyProfile(p,{type:'schedule',schedule:{mode:'rotation'}},ctx);assert.equal(rotationNext(p,[]).name,'Empurrar');
 const did=[{...workout('2026-11-01',BENCH,[set(80,5)]),routineId:p.routines[0].id}];assert.equal(rotationNext(p,did).name,'Puxar');assert.equal(todayOf({...p,schedule:{...p.schedule,moved:{}}},did,TODAY).routine.name,'Puxar');
 const loose=looseExercise(BENCH,p,[workout('2026-10-30',BENCH,[set(80,5),set(80,5),set(80,5)])],id);assert.equal(loose.sets.length,3);assert.equal(loose.sets[0].weight,80);});

test('treino lançado depois: só séries com dados, limites e datas válidas',()=>{
 const w=cleanWorkout({id:'p1',date:'2026-10-30',name:'No papel',durationMin:40,exercises:[{exerciseId:BENCH,sets:[{id:'s1',weight:70,reps:8}]}]},isCatalogId);assert.equal(w.exercises[0].sets[0].done,true);assert.equal(w.startedAt,'2026-10-30T12:00:00.000Z');
 assert.throws(()=>cleanWorkout({id:'p2',date:'2026-13-01',exercises:[]},isCatalogId),/Data/);assert.throws(()=>cleanWorkout({id:'p3',date:'2026-10-30',exercises:[]},isCatalogId),/pelo menos/);});

test('descanso escolhido no treino: vale para as próximas séries e muda o descanso que já corre, contando da série feita',()=>{
 const p=applyProfile(emptyProfile(),{type:'routine',routine:routine({items:[{id:'a',exerciseId:BENCH,sets:3,reps:5},{id:'b',exerciseId:'Bent_Over_Barbell_Row',sets:3,reps:5,superset:true},{id:'c',exerciseId:'Barbell_Curl',sets:2,reps:10}]})},ctx);
 assert.deepEqual(REST_PRESETS,[60,90,120,150,180]);
 let a=buildActive(p,[],p.routines[0],{id:'r',date:TODAY,at:at(),newId:id});const [A,B,C]=a.exercises;
 a=applyActive(a,{type:'restSec',exId:A.id,sec:120},at(),isCatalogId);assert.deepEqual(a.exercises.map(e=>e.restSec),[120,120,90],'o superset descansa junto');
 a=applyActive(a,{type:'restSec',exId:C.id,sec:60},at(),isCatalogId);a=applyActive(a,{type:'done',exId:C.id,setId:C.sets[0].id,done:true},at(1),isCatalogId);assert.equal(restLeft(a.rest,at(1).getTime()),60);
 a=applyActive(a,{type:'rest',action:'length',sec:150},new Date(at(1).getTime()+20000),isCatalogId);assert.equal(restLeft(a.rest,at(1).getTime()+20000),130,'2,5 min contados de quando a série terminou');assert.equal(a.rest.total,150);
 a=applyActive(a,{type:'rest',action:'pause'},new Date(at(1).getTime()+30000),isCatalogId);assert.equal(a.rest.pausedLeft,120);
 a=applyActive(a,{type:'rest',action:'length',sec:60},new Date(at(1).getTime()+40000),isCatalogId);assert.equal(a.rest.pausedLeft,30,'pausado: tira o que já passou');
 assert.deepEqual(cleanActive(JSON.parse(JSON.stringify(a)),isCatalogId).rest,a.rest);
 a=applyActive(a,{type:'rest',action:'length',sec:0},at(3),isCatalogId);assert.equal(a.rest,null);
 assert.throws(()=>applyActive(a,{type:'restSec',exId:A.id,sec:2000},at(3),isCatalogId),/Descanso/);void B;});

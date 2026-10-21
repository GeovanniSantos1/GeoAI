import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardScore,buildDayPlan,planProgress,cleanPlan,emptyPlan} from '../lib/day-plan.ts';
const T='2026-10-20';
const c=(n,over={})=>({id:'c'+n,number:n,title:'Card '+n,status:'todo',priority:'medium',dueDate:null,estimate:2,...over});
test('cardScore: prioridade, prazo, andamento, backlog e motivos',()=>{
 assert.deepEqual(cardScore(c(1,{priority:'critical'}),T),{score:40,reason:'prioridade crítica'});
 assert.deepEqual(cardScore(c(1,{dueDate:'2026-10-18',priority:'high'}),T),{score:25+50+10,reason:'atrasado há 2 dias · prioridade alta'});
 assert.deepEqual(cardScore(c(1,{dueDate:'2026-10-19'}),T),{score:10+55,reason:'atrasado há 1 dia'});
 assert.deepEqual(cardScore(c(1,{dueDate:'2026-09-01'}),T),{score:10+100,reason:'atrasado há 49 dias'});
 assert.deepEqual([cardScore(c(1,{dueDate:T}),T).reason,cardScore(c(1,{dueDate:'2026-10-21'}),T).reason,cardScore(c(1,{dueDate:'2026-10-23'}),T).reason,cardScore(c(1,{dueDate:'2026-10-24'}),T).reason],['prazo hoje','prazo amanhã','prazo em 3 dias','próximo da fila']);
 assert.deepEqual(cardScore(c(1,{status:'doing'}),T),{score:25,reason:'já em andamento'});assert.equal(cardScore(c(1,{status:'backlog',priority:'low'}),T).score,-20);});
test('buildDayPlan: mantém a ordem do usuário, não traz removidos e respeita os disponíveis',()=>{
 const cards=[c(1,{priority:'low'}),c(2,{priority:'critical',estimate:8}),c(3,{dueDate:'2026-10-19'}),c(4,{status:'done'}),c(5,{estimate:0}),c(6,{priority:'high',estimate:3})];
 const sessions=[{id:'s',title:'x',date:'2026-10-18',duration:25,boardCardId:'c6'}];
 const plan={available:8,items:[{cardId:'c1',pomodoros:2,reason:''}],removed:['c3']};
 const r=buildDayPlan(cards,sessions,plan,8,T);
 assert.deepEqual(r.items.map(i=>[i.cardId,i.pomodoros]),[['c1',2],['c2',4],['c6',2]]);assert.deepEqual(r.removed,['c3']);assert.equal(r.available,8);
 assert.equal(r.items[0].reason,'próximo da fila');
 assert.deepEqual(buildDayPlan(cards,[],emptyPlan(),3,T).items.map(i=>[i.cardId,i.pomodoros]),[['c3',2],['c5',1]]);
 assert.equal(buildDayPlan(cards,[],emptyPlan(),99,T).available,16);assert.equal(buildDayPlan(cards,[],emptyPlan(),0,T).available,1);});
test('planProgress conta os focos concluídos hoje em cada item',()=>{const plan={available:8,items:[{cardId:'c1',pomodoros:2,reason:''},{cardId:'c2',pomodoros:1,reason:''}],removed:[]};
 const s=[{id:'a',title:'x',date:T,duration:25,boardCardId:'c1'},{id:'b',title:'x',date:T,duration:25,boardCardId:'c1',status:'interrupted'},{id:'d',title:'x',date:'2026-10-19',duration:25,boardCardId:'c2'}];
 assert.deepEqual(planProgress(plan,s,T),{c1:1,c2:0});});
test('cleanPlan valida e descarta cards que não existem mais',()=>{const ids=new Set(['c1','c2']);
 assert.deepEqual(cleanPlan({available:6,items:[{cardId:'c1',pomodoros:2,reason:'x'},{cardId:'zz',pomodoros:1}],removed:['c9','c9','a b']},ids),{available:6,items:[{cardId:'c1',pomodoros:2,reason:'x'}],removed:['c9']});
 assert.equal(cleanPlan({available:6,items:[{cardId:'zz',pomodoros:1}],removed:[]}).items.length,1);
 for(const [raw,msg] of [[{available:0,items:[]},/entre 1 e 16/],[{available:4,items:[{cardId:'c1',pomodoros:5}]},/1 a 4 pomodoros/],[{available:4,items:[{cardId:'c1',pomodoros:1},{cardId:'c1',pomodoros:1}]},/repetido/],[{available:4,items:Array.from({length:17},(_,i)=>({cardId:'k'+i,pomodoros:1}))},/16 itens/],[null,/Plano inválido/]])assert.throws(()=>cleanPlan(raw,ids),msg);});

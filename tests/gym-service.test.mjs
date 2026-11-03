import {test} from 'node:test';
import assert from 'node:assert/strict';
import {memoryGymStore,GymConflict} from '../lib/gym-store.ts';
import {loadGym,profileCommand,activeCommand,addWorkout,editWorkout,removeWorkout,workoutPage,instant,PAGE} from '../lib/gym-service.ts';
import {buildActive} from '../lib/gym-plan.ts';

const TODAY='2026-11-03';
const NOW=new Date('2026-11-03T13:00:00Z');
let n=0;const id=()=>'s'+(++n);
const deps=(store=memoryGymStore(),userId='u1')=>({userId,store,now:()=>NOW});
const BENCH='Barbell_Bench_Press_-_Medium_Grip';
const later=min=>new Date(NOW.getTime()+min*60000);

test('primeira visita: perfil vazio, sem treino ativo e histórico vazio',async()=>{
 const v=await loadGym(deps());assert.equal(v.rev,0);assert.equal(v.profile.routines.length,0);assert.equal(v.active,null);assert.deepEqual(v.workouts,[]);assert.equal(v.next,null);});

test('comandos do plano gravam com versão; um usuário não vê o do outro',async()=>{
 const store=memoryGymStore(),d=deps(store);
 const r=await profileCommand(d,{type:'starter',key:'ppl',seed:'a'},TODAY);assert.equal(r.rev,1);assert.equal(r.profile.routines.length,3);
 const r2=await profileCommand(d,{type:'settings',settings:{unit:'lb'}},TODAY);assert.equal(r2.rev,2);assert.equal(r2.profile.routines.length,3,'aplica sobre a versão mais nova');
 assert.equal((await loadGym(deps(store,'u2'))).profile.routines.length,0);
 await assert.rejects(profileCommand(d,{type:'deleteRoutine',id:'nada'},TODAY),/não encontrada/);});

test('treino do começo ao fim: começar, marcar, descansar, finalizar sem duplicar',async()=>{
 const store=memoryGymStore(),d=deps(store);const {profile}=await profileCommand(d,{type:'starter',key:'fiveByFive',seed:'b'},TODAY);
 const built=buildActive(profile,[],profile.routines[0],{id:'w1',date:TODAY,at:NOW,newId:id});
 let r=await activeCommand(d,{type:'start',workout:built},NOW);assert.equal(r.activeRev,1);
 const again=await activeCommand(d,{type:'start',workout:{...built,id:'w2'}},NOW);assert.equal(again.existing,true);assert.equal(again.active.id,'w1','não apaga o treino aberto sem pedir');
 const ex=r.active.exercises[0];
 r=await activeCommand(d,{type:'set',exId:ex.id,setId:ex.sets[0].id,field:'weight',value:60},later(1));
 r=await activeCommand(d,{type:'done',exId:ex.id,setId:ex.sets[0].id,done:true},later(1));assert.ok(r.active.rest);assert.equal(r.activeRev,3);
 assert.equal((await loadGym(d)).active.rest.endsAt,r.active.rest.endsAt,'outro aparelho vê o mesmo descanso');
 const f=await activeCommand(d,{type:'finish',id:'w1',prs:0},later(45));assert.equal(f.workout.durationMin,45);assert.equal(f.active,null);
 const f2=await activeCommand(d,{type:'finish',id:'w1'},later(46));assert.equal(f2.workout.id,'w1','finalizar de novo devolve o salvo');
 const v=await loadGym(d);assert.equal(v.active,null);assert.equal(v.workouts.length,1);
 await assert.rejects(activeCommand(d,{type:'done',exId:ex.id,setId:ex.sets[1].id,done:true},later(47)),/Nenhum treino/);});

test('descartar e trocar o treino aberto; treino com exercício desconhecido é recusado',async()=>{
 const d=deps();const {profile}=await profileCommand(d,{type:'starter',key:'fullBody',seed:'c'},TODAY);
 const a=buildActive(profile,[],profile.routines[0],{id:'w1',date:TODAY,at:NOW,newId:id});await activeCommand(d,{type:'start',workout:a},NOW);
 const b=buildActive(profile,[],profile.routines[1],{id:'w2',date:TODAY,at:NOW,newId:id});const r=await activeCommand(d,{type:'start',workout:b,replace:true},NOW);assert.equal(r.active.id,'w2');
 assert.equal((await activeCommand(d,{type:'discard'},NOW)).active,null);
 await assert.rejects(activeCommand(d,{type:'start',workout:{...a,exercises:[{...a.exercises[0],exerciseId:'Inventado'}]}},NOW),/desconhecido/);});

test('histórico: lançar, editar com versão, excluir e paginar',async()=>{
 const store=memoryGymStore(),d=deps(store);
 const w=await addWorkout(d,{id:'p1',date:'2026-10-30',name:'Papel',durationMin:30,exercises:[{exerciseId:BENCH,sets:[{id:'a',weight:70,reps:8}]}]});assert.equal(w.rev,1);
 assert.equal((await addWorkout(d,{id:'p1',date:'2026-10-30',exercises:[{exerciseId:BENCH,sets:[{id:'a',weight:70,reps:8}]}]})).name,'Papel','repetir o envio não duplica');
 const e=await editWorkout(d,'p1',{...w,name:'Peito na quinta',date:'2026-10-29'});assert.equal(e.rev,2);assert.equal(e.date,'2026-10-29');
 await assert.rejects(editWorkout(d,'p1',{...w,name:'Velho'}),/outro aparelho/,'edição de uma versão antiga é recusada');
 assert.deepEqual(await removeWorkout(d,'p1'),{ok:true});await assert.rejects(removeWorkout(d,'p1'),/não encontrado/);
 for(let i=0;i<PAGE+5;i++)await addWorkout(d,{id:'q'+i,date:'2026-0'+(1+i%9)+'-1'+(i%9),exercises:[{exerciseId:BENCH,sets:[{id:'x',weight:50,reps:5}]}]});
 const p1=await workoutPage(d);assert.equal(p1.workouts.length,PAGE);assert.ok(p1.next);const p2=await workoutPage(d,p1.next);assert.equal(p2.workouts.length,5);assert.equal(p2.next,null);
 assert.equal(new Set([...p1.workouts,...p2.workouts].map(x=>x.id)).size,PAGE+5,'páginas sem repetir');});

test('instante do aparelho: aceita até 1 dia atrás e 10 min à frente; fora disso, vale o do servidor',()=>{
 const d=deps();assert.equal(instant(d,'2026-11-03T12:00:00Z').toISOString(),'2026-11-03T12:00:00.000Z');assert.equal(instant(d,'2026-11-05T12:00:00Z'),NOW);assert.equal(instant(d,'lixo'),NOW);});

test('store em memória: gravar por cima de outra versão dá conflito',async()=>{
 const s=memoryGymStore();await s.putProfile('u',{v:1},0);await assert.rejects(s.putProfile('u',{v:1},0),GymConflict);assert.equal(await s.putProfile('u',{v:1},1),2);});

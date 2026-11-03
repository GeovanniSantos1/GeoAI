// Plano do Gym: planos iniciais, o treino do dia (semana fixa ou rotação), a semana e a montagem do treino ativo. Puro.
import {WEEKDAYS,weekdayOf,shiftDate,type GymProfile,type Routine,type RoutineItem,type Weekday,type StarterKey,type Progression} from './gym.ts';
import type {ActiveWorkout,ActiveExercise,GymSet,Workout} from './gym-active.ts';
import {exerciseOf,defaultIncrement} from './gym-catalog.ts';
import {sessionsOf} from './gym-stats.ts';
import {nextTarget} from './gym-progression.ts';
import {warmupRamp} from './gym-plates.ts';

type Spec=[exerciseId:string,sets:number,reps:number,repMax?:number|null,restSec?:number];
const PLANS:Record<StarterKey,{label:string;description:string;progression:Progression;routines:{name:string;icon:Routine['icon'];items:Spec[]}[];days:Partial<Record<Weekday,number>>}>={
 ppl:{label:'Push / Pull / Legs',description:'Empurrar, puxar e pernas em três dias. Bom para quem treina 3 a 6 vezes por semana.',progression:'double',days:{mon:0,wed:1,fri:2},routines:[
  {name:'Empurrar',icon:'push',items:[['Barbell_Bench_Press_-_Medium_Grip',4,6,10,150],['Incline_Dumbbell_Press',3,8,12,120],['Seated_Dumbbell_Press',3,8,12,120],['Side_Lateral_Raise',3,12,15,60],['Triceps_Pushdown',3,10,15,60]]},
  {name:'Puxar',icon:'pull',items:[['Wide-Grip_Lat_Pulldown',4,8,12,120],['Bent_Over_Barbell_Row',3,6,10,150],['Seated_Cable_Rows',3,10,12,90],['Face_Pull',3,12,15,60],['Barbell_Curl',3,8,12,60],['Hammer_Curls',2,10,12,60]]},
  {name:'Pernas',icon:'legs',items:[['Barbell_Squat',4,6,10,180],['Romanian_Deadlift',3,8,10,150],['Leg_Press',3,10,15,120],['Lying_Leg_Curls',3,10,15,60],['Standing_Calf_Raises',4,10,15,60]]}]},
 upperLower:{label:'Superior / Inferior',description:'Quatro treinos por semana, alternando parte de cima e parte de baixo.',progression:'double',days:{mon:0,tue:1,thu:2,fri:3},routines:[
  {name:'Superior A',icon:'push',items:[['Barbell_Bench_Press_-_Medium_Grip',4,6,8,150],['Bent_Over_Barbell_Row',4,6,8,150],['Seated_Dumbbell_Press',3,8,12,90],['Wide-Grip_Lat_Pulldown',3,8,12,90],['Triceps_Pushdown',2,10,15,60]]},
  {name:'Inferior A',icon:'legs',items:[['Barbell_Squat',4,5,8,180],['Romanian_Deadlift',3,8,10,150],['Leg_Extensions',3,10,15,60],['Lying_Leg_Curls',3,10,15,60],['Standing_Calf_Raises',3,10,15,60]]},
  {name:'Superior B',icon:'pull',items:[['Incline_Dumbbell_Press',4,8,12,120],['Pullups',4,6,10,120],['Side_Lateral_Raise',3,12,15,60],['Seated_Cable_Rows',3,10,12,90],['Barbell_Curl',2,10,12,60]]},
  {name:'Inferior B',icon:'legs',items:[['Barbell_Deadlift',3,4,6,180],['Leg_Press',3,10,15,120],['Dumbbell_Lunges',3,10,12,90],['Seated_Calf_Raise',3,12,15,60],['Plank',3,1,null,60]]}]},
 fullBody:{label:'Corpo inteiro',description:'Três treinos completos por semana, com descanso entre eles. Ótimo para começar.',progression:'linear',days:{mon:0,wed:1,fri:0},routines:[
  {name:'Corpo inteiro A',icon:'full',items:[['Barbell_Squat',3,8,null,150],['Barbell_Bench_Press_-_Medium_Grip',3,8,null,150],['Bent_Over_Barbell_Row',3,8,null,120],['Plank',3,1,null,60]]},
  {name:'Corpo inteiro B',icon:'full',items:[['Barbell_Deadlift',3,5,null,180],['Standing_Military_Press',3,8,null,120],['Wide-Grip_Lat_Pulldown',3,10,null,90],['Dumbbell_Lunges',3,10,null,90]]}]},
 fiveByFive:{label:'5×5',description:'Poucos exercícios, cargas que sobem a cada treino. A e B alternados, três vezes por semana.',progression:'linear',days:{mon:0,wed:1,fri:0},routines:[
  {name:'5×5 A',icon:'dumbbell',items:[['Barbell_Squat',5,5,null,180],['Barbell_Bench_Press_-_Medium_Grip',5,5,null,180],['Bent_Over_Barbell_Row',5,5,null,180]]},
  {name:'5×5 B',icon:'dumbbell',items:[['Barbell_Squat',5,5,null,180],['Standing_Military_Press',5,5,null,180],['Barbell_Deadlift',1,5,null,180]]}]}};
export const STARTERS=(Object.keys(PLANS) as StarterKey[]).map(key=>({key,label:PLANS[key].label,description:PLANS[key].description,routines:PLANS[key].routines.map(r=>r.name),days:Object.keys(PLANS[key].days).length}));
// Ids estáveis a partir da semente do comando, para o cliente e o servidor montarem a mesma coisa.
export function starterPlan(key:StarterKey,seed:string){const plan=PLANS[key];
 const routines:Routine[]=plan.routines.map((r,i)=>({id:'r'+seed.slice(0,40)+'-'+i,name:r.name,icon:r.icon,progression:plan.progression,deload:false,items:r.items.map(([exerciseId,sets,reps,repMax,restSec],j)=>{const timed=exerciseOf(exerciseId)?.timed;
  return {id:'i'+seed.slice(0,40)+'-'+i+'-'+j,exerciseId,sets,reps:timed?1:reps,repMax:timed?null:repMax??null,timeSec:timed?30:null,weight:null,restSec:restSec??null,superset:false,increment:null,progression:timed?'time':null,backupId:null,notes:''};})}));
 return {routines,days:plan.days};}

export type Today={kind:'routine';routine:Routine;moved:boolean;done:boolean}|{kind:'rest';next:{date:string;routine:Routine}|null;done:boolean}|{kind:'empty'};
export const routineOf=(p:GymProfile,id:string|null|undefined)=>id?p.routines.find(r=>r.id===id)||null:null;
// Na rotação, a próxima é a seguinte à última rotina da fila que você fez (em qualquer dia).
export function rotationNext(p:GymProfile,workouts:Workout[],before?:string){const list=p.schedule.rotation.filter(id=>routineOf(p,id));if(!list.length)return null;
 const last=workouts.filter(w=>w.routineId&&list.includes(w.routineId)&&(!before||w.date<before)).sort((a,b)=>b.date.localeCompare(a.date)||b.startedAt.localeCompare(a.startedAt))[0];
 return routineOf(p,last?list[(list.indexOf(last.routineId!)+1)%list.length]:list[0]);}
export function plannedFor(p:GymProfile,workouts:Workout[],date:string):{routine:Routine|null;moved:boolean}{
 if(date in p.schedule.moved)return {routine:routineOf(p,p.schedule.moved[date]),moved:true};
 if(p.schedule.mode==='rotation')return {routine:rotationNext(p,workouts,date),moved:false};
 return {routine:routineOf(p,p.schedule.days[weekdayOf(date)]),moved:false};}
export function todayOf(p:GymProfile,workouts:Workout[],today:string):Today{
 if(!p.routines.length)return {kind:'empty'};const done=workouts.some(w=>w.date===today);const {routine,moved}=plannedFor(p,workouts,today);
 if(routine)return {kind:'routine',routine,moved,done};
 // Dia de descanso: procura a próxima sessão planejada nos próximos 14 dias.
 if(p.schedule.mode==='week')for(let i=1;i<=14;i++){const d=shiftDate(today,i),next=plannedFor(p,workouts,d).routine;if(next)return {kind:'rest',next:{date:d,routine:next},done};}
 return {kind:'rest',next:null,done};}
export type Day={date:string;weekday:Weekday;routine:Routine|null;status:'done'|'planned'|'missed'|'rest';today:boolean};
export function weekOf(p:GymProfile,workouts:Workout[],today:string,offset=0):Day[]{
 const back=p.schedule.weekStart==='mon'?(new Date(today+'T12:00:00Z').getUTCDay()+6)%7:new Date(today+'T12:00:00Z').getUTCDay();const start=shiftDate(today,-back+offset*7);
 return Array.from({length:7},(_,i)=>{const date=shiftDate(start,i),done=workouts.some(w=>w.date===date),planned=p.schedule.mode==='week'||date in p.schedule.moved?plannedFor(p,workouts,date).routine:date===today?plannedFor(p,workouts,date).routine:null;
  return {date,weekday:weekdayOf(date),routine:planned,status:done?'done':planned?(date<today?'missed':'planned'):'rest',today:date===today};});}
export const orderedWeekdays=(start:'mon'|'sun')=>start==='mon'?[...WEEKDAYS]:(['sun',...WEEKDAYS.slice(0,6)] as Weekday[]);

export type BuildOptions={id:string;date:string;at:Date;newId:()=>string;name?:string};
// Monta o treino do dia: alvo da progressão por exercício e as séries já preenchidas com carga e reps.
export function exerciseFrom(item:RoutineItem,routine:Pick<Routine,'progression'>|null,p:GymProfile,workouts:Workout[],newId:()=>string):ActiveExercise{
 const ex=exerciseOf(item.exerciseId,p.custom),rule=item.progression||routine?.progression||'none',increment=item.increment??defaultIncrement(ex);
 const target=nextTarget(item,rule,sessionsOf(workouts,item.exerciseId),increment);
 const warm=p.settings.warmups&&ex?.equipment==='barbell'&&ex.mechanic==='compound'&&target.weight&&!target.timeSec?warmupRamp(target.weight,p.settings.bar,increment):[];
 const sets:GymSet[]=[...warm.map(w=>({id:newId(),kind:'warmup' as const,weight:w.weight,reps:w.reps,timeSec:null,effort:null,done:false,doneAt:null})),...Array.from({length:target.sets},()=>({id:newId(),kind:'work' as const,weight:target.weight,reps:target.timeSec?null:target.reps,timeSec:target.timeSec,effort:null,done:false,doneAt:null}))];
 return {id:newId(),exerciseId:item.exerciseId,restSec:item.restSec??p.settings.restSec,superset:item.superset,notes:item.notes,target,sets,...(item.backupId?{backupId:item.backupId}:{})};}
export function buildActive(p:GymProfile,workouts:Workout[],routine:Routine|null,o:BuildOptions):ActiveWorkout{
 return {id:o.id,routineId:routine?.id||null,name:o.name||routine?.name||'Treino livre',date:o.date,startedAt:o.at.toISOString(),cursor:0,notes:'',noProgression:!!routine?.deload,exercises:(routine?.items||[]).map(item=>exerciseFrom(item,routine,p,workouts,o.newId)),rest:null};}
// Exercício avulso (adicionado no meio do treino ou no treino livre): 3 séries, com a carga da última vez.
export function looseExercise(exerciseId:string,p:GymProfile,workouts:Workout[],newId:()=>string):ActiveExercise{const ex=exerciseOf(exerciseId,p.custom);
 return exerciseFrom({id:newId(),exerciseId,sets:3,reps:ex?.timed?1:10,repMax:null,timeSec:ex?.timed?30:null,weight:null,restSec:null,superset:false,increment:null,progression:'none',backupId:null,notes:''},null,p,workouts,newId);}

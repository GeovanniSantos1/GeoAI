// Leituras do histórico: sessões de um exercício, 1RM estimado, melhor série, recordes e números gerais. Puro.
import type {GymSet,Workout} from './gym-active.ts';
import {setVolume,volumeOf} from './gym-active.ts';
import {shiftDate} from './gym.ts';
export type Session={workoutId:string;date:string;startedAt:string;noProgression:boolean;sets:GymSet[]};

// Epley: carga × (1 + reps/30); uma rep é a própria carga. Acima de 30 reps a estimativa não diz nada.
export const e1rm=(weight:number|null,reps:number|null)=>!weight||!reps||reps<1?0:reps===1?weight:reps>30?0:Math.round(weight*(1+reps/30)*10)/10;
export const workSets=(sets:GymSet[])=>sets.filter(s=>s.done&&s.kind!=='warmup');
const newest=(a:{date:string;startedAt:string},b:{date:string;startedAt:string})=>b.date.localeCompare(a.date)||b.startedAt.localeCompare(a.startedAt);
// Sessões de um exercício, da mais nova para a mais antiga (um treino com o exercício duas vezes vira uma sessão só).
export function sessionsOf(workouts:Workout[],exerciseId:string,except?:string):Session[]{
 return workouts.filter(w=>w.id!==except).sort(newest).flatMap(w=>{const sets=w.exercises.filter(e=>e.exerciseId===exerciseId).flatMap(e=>e.sets);return sets.length?[{workoutId:w.id,date:w.date,startedAt:w.startedAt,noProgression:w.noProgression,sets}]:[];});}
export const lastSession=(workouts:Workout[],exerciseId:string,except?:string)=>sessionsOf(workouts,exerciseId,except)[0]||null;

export type Best={weight:number;reps:number;e1rm:number;timeSec:number;date:string}|null;
// Melhor marca: maior 1RM estimado; sem carga (peso corporal), mais reps; por tempo, mais segundos.
export function bestOf(sessions:Session[]):Best{let best:Best=null;
 for(const ss of sessions)for(const s of workSets(ss.sets)){const est=e1rm(s.weight,s.reps),cand={weight:s.weight||0,reps:s.reps||0,e1rm:est,timeSec:s.timeSec||0,date:ss.date};
  if(!best||cand.e1rm>best.e1rm||(cand.e1rm===best.e1rm&&(cand.reps>best.reps||cand.timeSec>best.timeSec)))best=cand;}
 return best;}
export const bestSet=(workouts:Workout[],exerciseId:string,except?:string)=>bestOf(sessionsOf(workouts,exerciseId,except));
// Recorde de uma série contra a melhor marca anterior: carga mais alta, 1RM estimado maior, ou (sem carga) mais reps / mais tempo.
export function isRecord(s:GymSet,best:Best,heaviest:number){if(!s.done||s.kind==='warmup')return false;
 if(!best)return !!(s.weight||s.reps||s.timeSec);
 if(s.weight&&s.weight>heaviest)return true;const est=e1rm(s.weight,s.reps);if(est>0&&est>best.e1rm)return true;
 if(!s.weight&&!best.weight){if((s.reps||0)>best.reps&&best.reps>0)return true;if((s.timeSec||0)>best.timeSec&&best.timeSec>0)return true;}
 return false;}
export const heaviestOf=(sessions:Session[])=>sessions.reduce((m,ss)=>Math.max(m,...workSets(ss.sets).map(s=>s.weight||0)),0);
// Recordes de um treino (no máximo um por exercício), contra tudo o que veio antes dele.
export function recordsIn(w:{id:string;date:string;startedAt:string;exercises:{exerciseId:string;sets:GymSet[]}[]},history:Workout[]){
 const before=history.filter(h=>h.id!==w.id&&(h.date<w.date||(h.date===w.date&&h.startedAt<w.startedAt)));const hits:string[]=[];
 for(const id of new Set(w.exercises.map(e=>e.exerciseId))){const prev=sessionsOf(before,id);if(!prev.length)continue;const best=bestOf(prev),heavy=heaviestOf(prev);
  if(w.exercises.filter(e=>e.exerciseId===id).some(e=>e.sets.some(s=>isRecord(s,best,heavy))))hits.push(id);}
 return hits;}

export type Totals={workouts:number;month:number;volume:number;minutes:number;sets:number};
export function totals(workouts:Workout[],today:string):Totals{const month=today.slice(0,7);
 return {workouts:workouts.length,month:workouts.filter(w=>w.date.startsWith(month)).length,volume:Math.round(workouts.reduce((v,w)=>v+volumeOf(w),0)),minutes:workouts.reduce((m,w)=>m+w.durationMin,0),sets:workouts.reduce((n,w)=>n+w.exercises.reduce((k,e)=>k+workSets(e.sets).length,0),0)};}
export const workoutSets=(w:Workout)=>w.exercises.reduce((n,e)=>n+workSets(e.sets).length,0);
export {setVolume,volumeOf};

// Semanas seguidas com pelo menos um treino, contando a atual se já teve treino (senão, a partir da anterior).
export function weekStreak(dates:string[],today:string,weekStart:'mon'|'sun'='mon'){
 const startOf=(d:string)=>{const day=new Date(d+'T12:00:00Z').getUTCDay();const back=weekStart==='mon'?(day+6)%7:day;return shiftDate(d,-back);};
 const weeks=new Set(dates.map(startOf));let w=startOf(today),n=0;if(!weeks.has(w))w=shiftDate(w,-7);while(weeks.has(w)){n++;w=shiftDate(w,-7);}return n;}

// Treino em andamento: séries, descanso e o fechamento em um treino salvo. Puro; cada comando leva o instante do aparelho.
import {GymError,LIMITS,isId,isExerciseId,isDate,cleanWeight} from './gym.ts';
export const SET_KINDS=['warmup','work','drop','burst'] as const;
export type SetKind=typeof SET_KINDS[number];
export const SET_KIND_LABEL:Record<SetKind,string>={warmup:'Aquecimento',work:'Série',drop:'Drop set',burst:'Rest-pause'};
export type GymSet={id:string;kind:SetKind;weight:number|null;reps:number|null;timeSec:number|null;effort:number|null;done:boolean;doneAt:string|null};
export type Target={sets:number;reps:number;repMax:number|null;timeSec:number|null;weight:number|null;why:string;deload:boolean};
export type ActiveExercise={id:string;exerciseId:string;restSec:number;superset:boolean;notes:string;target:Target|null;sets:GymSet[]};
export type Rest={exId:string;total:number;endsAt:string|null;pausedLeft:number|null};
export type ActiveWorkout={id:string;routineId:string|null;name:string;date:string;startedAt:string;cursor:number;notes:string;noProgression:boolean;exercises:ActiveExercise[];rest:Rest|null};
export type LoggedExercise={exerciseId:string;notes:string;sets:GymSet[]};
export type Workout={id:string;routineId:string|null;name:string;date:string;startedAt:string;durationMin:number;notes:string;noProgression:boolean;exercises:LoggedExercise[];prs:number;rev:number};
export const MAX_EXERCISES=40,MAX_SETS=30;
export type ActiveCommand=
 |{type:'set';exId:string;setId:string;field:'weight'|'reps'|'timeSec'|'effort';value:number|null}
 |{type:'done';exId:string;setId:string;done:boolean}
 |{type:'addSet';exId:string;setId:string;kind?:SetKind}
 |{type:'removeSet';exId:string;setId:string}
 |{type:'setKind';exId:string;setId:string;kind:SetKind}
 |{type:'addExercise';exercise:unknown;index?:number}
 |{type:'removeExercise';exId:string}
 |{type:'swap';exId:string;exerciseId:string;weight?:number|null}
 |{type:'moveExercise';exId:string;dir:-1|1}
 |{type:'note';exId?:string;text:string}
 |{type:'cursor';index:number}
 |{type:'rest';action:'add'|'pause'|'resume'|'skip'|'set';sec?:number}
 |{type:'rename';name:string}
 |{type:'flag';noProgression:boolean};

const num=(v:unknown,min:number,max:number,label:string,int=true)=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<min||n>max||(int&&!Number.isInteger(n)))throw new GymError(label+' inválido.');return n;};
const effortOf=(v:unknown)=>{const n=num(v,0,10,'Esforço',false);return n===null?null:Math.round(n*2)/2;};
const str=(v:unknown,max:number)=>typeof v==='string'?v.trim().slice(0,max):'';
export function cleanSet(raw:any):GymSet{if(!raw||typeof raw!=='object'||!isId(raw.id))throw new GymError('Série inválida.');
 return {id:raw.id,kind:SET_KINDS.includes(raw.kind)?raw.kind:'work',weight:cleanWeight(raw.weight),reps:num(raw.reps,0,LIMITS.reps*5,'Repetições'),timeSec:num(raw.timeSec,0,LIMITS.timeSec,'Tempo'),effort:effortOf(raw.effort),done:raw.done===true,doneAt:raw.done===true&&typeof raw.doneAt==='string'&&!isNaN(Date.parse(raw.doneAt))?new Date(raw.doneAt).toISOString():null};}
function cleanTarget(raw:any):Target|null{if(!raw||typeof raw!=='object')return null;
 return {sets:num(raw.sets,1,LIMITS.sets,'Séries')??3,reps:num(raw.reps,1,LIMITS.reps,'Repetições')??10,repMax:num(raw.repMax,1,LIMITS.reps,'Faixa'),timeSec:num(raw.timeSec,1,LIMITS.timeSec,'Tempo'),weight:cleanWeight(raw.weight),why:str(raw.why,200),deload:raw.deload===true};}
export function cleanExercise(raw:any,known:(id:string)=>boolean):ActiveExercise{if(!raw||typeof raw!=='object'||!isId(raw.id))throw new GymError('Exercício inválido.');
 if(!isExerciseId(raw.exerciseId)||!known(raw.exerciseId))throw new GymError('Exercício desconhecido.');
 const sets=(Array.isArray(raw.sets)?raw.sets:[]).map(cleanSet);if(sets.length>MAX_SETS)throw new GymError('Até '+MAX_SETS+' séries por exercício.');
 return {id:raw.id,exerciseId:raw.exerciseId,restSec:num(raw.restSec,0,LIMITS.restSec,'Descanso')??90,superset:raw.superset===true,notes:str(raw.notes,LIMITS.notes),target:cleanTarget(raw.target),sets};}
// O treino montado no aparelho (alvos da progressão já calculados) é conferido aqui antes de gravar.
export function cleanActive(raw:any,known:(id:string)=>boolean):ActiveWorkout{if(!raw||typeof raw!=='object'||!isId(raw.id))throw new GymError('Treino inválido.');
 if(!isDate(raw.date))throw new GymError('Data do treino inválida.');if(typeof raw.startedAt!=='string'||isNaN(Date.parse(raw.startedAt)))throw new GymError('Horário de início inválido.');
 const exercises=(Array.isArray(raw.exercises)?raw.exercises:[]).map((x:any)=>cleanExercise(x,known));if(exercises.length>MAX_EXERCISES)throw new GymError('Até '+MAX_EXERCISES+' exercícios por treino.');
 if(exercises[0])exercises[0].superset=false;
 const rest=raw.rest&&typeof raw.rest==='object'&&exercises.some((e:ActiveExercise)=>e.id===raw.rest.exId)?{exId:raw.rest.exId,total:num(raw.rest.total,0,LIMITS.restSec,'Descanso')??0,endsAt:typeof raw.rest.endsAt==='string'&&!isNaN(Date.parse(raw.rest.endsAt))?new Date(raw.rest.endsAt).toISOString():null,pausedLeft:num(raw.rest.pausedLeft,0,LIMITS.restSec*2,'Descanso')}:null;
 return {id:raw.id,routineId:isId(raw.routineId)?raw.routineId:null,name:str(raw.name,LIMITS.name)||'Treino',date:raw.date,startedAt:new Date(raw.startedAt).toISOString(),cursor:Math.max(0,Math.min(exercises.length-1,Number.isInteger(raw.cursor)?raw.cursor:0)),notes:str(raw.notes,LIMITS.notes*2),noProgression:raw.noProgression===true,exercises,rest:rest&&(rest.endsAt||rest.pausedLeft!==null)?rest:null};}

// Grupo de superset: exercícios seguidos em que cada um está "junto com o anterior".
export function groupOf(a:ActiveWorkout,index:number){let start=index;while(start>0&&a.exercises[start].superset)start--;let end=index;while(end+1<a.exercises.length&&a.exercises[end+1].superset)end++;return {start,end};}
export const pending=(e:ActiveExercise)=>e.sets.some(s=>!s.done);
export function restLeft(rest:Rest|null,now:number){if(!rest)return 0;if(rest.pausedLeft!==null)return rest.pausedLeft;return rest.endsAt?Math.max(0,Math.ceil((Date.parse(rest.endsAt)-now)/1000)):0;}

export function applyActive(current:ActiveWorkout,command:ActiveCommand,at:Date,known:(id:string)=>boolean):ActiveWorkout{
 const a=structuredClone(current),c=command as any,iso=at.toISOString();if(!c||typeof c!=='object')throw new GymError('Comando inválido.');
 const exIndex=(id:string)=>{const i=a.exercises.findIndex(e=>e.id===id);if(i<0)throw new GymError('Exercício não está neste treino.',404);return i;};
 const setOf=(e:ActiveExercise,id:string)=>{const s=e.sets.find(x=>x.id===id);if(!s)throw new GymError('Série não encontrada.',404);return s;};
 const startRest=(exId:string,sec:number)=>{a.rest=sec>0?{exId,total:sec,endsAt:new Date(at.getTime()+sec*1000).toISOString(),pausedLeft:null}:null;};
 switch(c.type){
  case 'set':{const e=a.exercises[exIndex(c.exId)],s=setOf(e,c.setId);
   if(c.field==='weight')s.weight=cleanWeight(c.value);else if(c.field==='reps')s.reps=num(c.value,0,LIMITS.reps*5,'Repetições');else if(c.field==='timeSec')s.timeSec=num(c.value,0,LIMITS.timeSec,'Tempo');else if(c.field==='effort')s.effort=effortOf(c.value);else throw new GymError('Campo inválido.');return a;}
  case 'done':{const i=exIndex(c.exId),e=a.exercises[i],s=setOf(e,c.setId);s.done=c.done===true;s.doneAt=s.done?iso:null;if(!s.done)return a;
   // Num superset, a série passa para o próximo exercício do grupo sem descanso; o descanso vem depois do último.
   const g=groupOf(a,i);const nextInGroup=a.exercises.slice(i+1,g.end+1).findIndex(pending);
   if(nextInGroup>=0){a.cursor=i+1+nextInGroup;a.rest=null;return a;}
   startRest(e.id,a.exercises[g.end].restSec||e.restSec);
   const groupLeft=a.exercises.slice(g.start,g.end+1).findIndex(pending);
   if(groupLeft>=0)a.cursor=g.start+groupLeft;else{const next=a.exercises.findIndex((x,k)=>k>g.end&&pending(x));a.cursor=next>=0?next:i;}
   return a;}
  case 'addSet':{const e=a.exercises[exIndex(c.exId)];if(!isId(c.setId)||e.sets.some(s=>s.id===c.setId))throw new GymError('Série inválida.');if(e.sets.length>=MAX_SETS)throw new GymError('Até '+MAX_SETS+' séries por exercício.');
   const last=e.sets[e.sets.length-1];e.sets.push({id:c.setId,kind:SET_KINDS.includes(c.kind)?c.kind:'work',weight:last?.weight??e.target?.weight??null,reps:last?.reps??e.target?.reps??null,timeSec:last?.timeSec??e.target?.timeSec??null,effort:null,done:false,doneAt:null});return a;}
  case 'removeSet':{const e=a.exercises[exIndex(c.exId)];setOf(e,c.setId);e.sets=e.sets.filter(s=>s.id!==c.setId);return a;}
  case 'setKind':{const e=a.exercises[exIndex(c.exId)];if(!SET_KINDS.includes(c.kind))throw new GymError('Tipo de série inválido.');setOf(e,c.setId).kind=c.kind;return a;}
  case 'addExercise':{if(a.exercises.length>=MAX_EXERCISES)throw new GymError('Até '+MAX_EXERCISES+' exercícios por treino.');const e=cleanExercise(c.exercise,known);if(a.exercises.some(x=>x.id===e.id))throw new GymError('Exercício repetido.');
   const at2=Number.isInteger(c.index)?Math.max(0,Math.min(a.exercises.length,c.index)):a.exercises.length;if(at2===0)e.superset=false;a.exercises.splice(at2,0,e);a.cursor=at2;return a;}
  case 'removeExercise':{const i=exIndex(c.exId);a.exercises.splice(i,1);if(a.exercises[0])a.exercises[0].superset=false;if(a.rest?.exId===c.exId)a.rest=null;a.cursor=Math.max(0,Math.min(a.cursor,a.exercises.length-1));return a;}
  case 'swap':{const e=a.exercises[exIndex(c.exId)];if(!isExerciseId(c.exerciseId)||!known(c.exerciseId))throw new GymError('Exercício desconhecido.');
   // A troca mantém séries e reps do lugar; as cargas de outro exercício não valem aqui, então só as séries feitas ficam como estão.
   e.exerciseId=c.exerciseId;const w=cleanWeight(c.weight);for(const s of e.sets)if(!s.done)s.weight=w;if(e.target)e.target={...e.target,weight:w,why:'Trocado no treino.'};return a;}
  case 'moveExercise':{const i=exIndex(c.exId),j=i+(c.dir===-1?-1:1);if(j<0||j>=a.exercises.length)return a;[a.exercises[i],a.exercises[j]]=[a.exercises[j],a.exercises[i]];if(a.exercises[0])a.exercises[0].superset=false;a.cursor=j;return a;}
  case 'note':{if(c.exId){a.exercises[exIndex(c.exId)].notes=str(c.text,LIMITS.notes);}else a.notes=str(c.text,LIMITS.notes*2);return a;}
  case 'cursor':{if(!Number.isInteger(c.index)||c.index<0||c.index>=a.exercises.length)throw new GymError('Exercício inválido.');a.cursor=c.index;return a;}
  case 'rest':{const r=a.rest;
   if(c.action==='skip'){a.rest=null;return a;}
   if(c.action==='set'){const sec=num(c.sec,0,LIMITS.restSec,'Descanso')??0;const ex=a.exercises[a.cursor];startRest(r?.exId||ex?.id||'',sec);if(a.rest&&!a.exercises.some(e=>e.id===a.rest!.exId))a.rest=null;return a;}
   if(!r)return a;
   if(c.action==='pause'){if(r.pausedLeft===null){r.pausedLeft=restLeft(r,at.getTime());r.endsAt=null;}return a;}
   if(c.action==='resume'){if(r.pausedLeft!==null){r.endsAt=new Date(at.getTime()+r.pausedLeft*1000).toISOString();r.pausedLeft=null;}return a;}
   if(c.action==='add'){const sec=num(c.sec,-LIMITS.restSec,LIMITS.restSec,'Descanso')??0;const left=Math.min(LIMITS.restSec,restLeft(r,at.getTime())+sec);
    if(left<=0){a.rest=null;return a;}r.total=Math.max(r.total,left);if(r.pausedLeft!==null)r.pausedLeft=left;else r.endsAt=new Date(at.getTime()+left*1000).toISOString();return a;}
   throw new GymError('Ação de descanso inválida.');}
  case 'rename':{const n=str(c.name,LIMITS.name);if(!n)throw new GymError('Dê um nome ao treino.');a.name=n;return a;}
  case 'flag':{a.noProgression=c.noProgression===true;return a;}
 }
 throw new GymError('Comando desconhecido.');}

export const doneSets=(a:Pick<ActiveWorkout,'exercises'>)=>a.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0);
export const totalSets=(a:Pick<ActiveWorkout,'exercises'>)=>a.exercises.reduce((n,e)=>n+e.sets.length,0);
// Volume: carga × reps das séries feitas, sem o aquecimento. Peso corporal sem carga extra não entra.
export const setVolume=(s:GymSet)=>s.done&&s.kind!=='warmup'&&s.weight&&s.reps?s.weight*s.reps:0;
export const volumeOf=(w:{exercises:{sets:GymSet[]}[]})=>Math.round(w.exercises.reduce((v,e)=>v+e.sets.reduce((x,s)=>x+setVolume(s),0),0)*10)/10;
// Fecha o treino: só ficam as séries feitas e os exercícios com alguma série feita. O id do ativo vira o id do treino salvo.
export function finishWorkout(a:ActiveWorkout,at:Date,prs=0):Workout{
 const exercises=a.exercises.map(e=>({exerciseId:e.exerciseId,notes:e.notes,sets:e.sets.filter(s=>s.done)})).filter(e=>e.sets.length);
 if(!exercises.length)throw new GymError('Nenhuma série marcada como feita. Marque as séries ou descarte o treino.');
 const minutes=Math.round((at.getTime()-Date.parse(a.startedAt))/60000);
 return {id:a.id,routineId:a.routineId,name:a.name,date:a.date,startedAt:a.startedAt,durationMin:Math.max(1,Math.min(600,minutes)),notes:a.notes,noProgression:a.noProgression,exercises,prs:Math.max(0,Math.min(999,Math.round(Number(prs)||0))),rev:1};}
export function cleanWorkout(raw:any,known:(id:string)=>boolean):Workout{if(!raw||typeof raw!=='object'||!isId(raw.id))throw new GymError('Treino inválido.');
 if(!isDate(raw.date))throw new GymError('Data do treino inválida.');const startedAt=typeof raw.startedAt==='string'&&!isNaN(Date.parse(raw.startedAt))?new Date(raw.startedAt).toISOString():raw.date+'T12:00:00.000Z';
 const exercises=(Array.isArray(raw.exercises)?raw.exercises:[]).map((e:any)=>{if(!e||!isExerciseId(e.exerciseId)||!known(e.exerciseId))throw new GymError('Exercício desconhecido.');const sets=(Array.isArray(e.sets)?e.sets:[]).map((s:any)=>({...cleanSet({...s,done:true,doneAt:s?.doneAt||startedAt})}));if(sets.length>MAX_SETS)throw new GymError('Até '+MAX_SETS+' séries por exercício.');return {exerciseId:e.exerciseId,notes:str(e.notes,LIMITS.notes),sets};}).filter((e:LoggedExercise)=>e.sets.length);
 if(!exercises.length)throw new GymError('Registre pelo menos uma série.');if(exercises.length>MAX_EXERCISES)throw new GymError('Até '+MAX_EXERCISES+' exercícios por treino.');
 return {id:raw.id,routineId:isId(raw.routineId)?raw.routineId:null,name:str(raw.name,LIMITS.name)||'Treino',date:raw.date,startedAt,durationMin:num(raw.durationMin,1,600,'Duração')??45,notes:str(raw.notes,LIMITS.notes*2),noProgression:raw.noProgression===true,exercises,prs:Math.max(0,Math.min(999,Math.round(Number(raw.prs)||0))),rev:Number.isInteger(raw.rev)&&raw.rev>0?raw.rev:1};}

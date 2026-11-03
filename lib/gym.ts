// Modo Gym: tipos, limites e o perfil de treino (rotinas, agenda, ajustes, favoritos, exercícios próprios).
// Puro: o cliente aplica o comando na hora e o servidor aplica o mesmo comando antes de gravar.
export const WEEKDAYS=['mon','tue','wed','thu','fri','sat','sun'] as const;
export type Weekday=typeof WEEKDAYS[number];
export const WEEKDAY_SHORT:Record<Weekday,string>={mon:'Seg',tue:'Ter',wed:'Qua',thu:'Qui',fri:'Sex',sat:'Sáb',sun:'Dom'};
export const WEEKDAY_LONG:Record<Weekday,string>={mon:'Segunda',tue:'Terça',wed:'Quarta',thu:'Quinta',fri:'Sexta',sat:'Sábado',sun:'Domingo'};
export const PROGRESSIONS=['none','linear','double','triple','greyskull','time'] as const;
export type Progression=typeof PROGRESSIONS[number];
export const PROGRESSION_LABEL:Record<Progression,string>={none:'Sem progressão',linear:'Linear',double:'Dupla (faixa de reps)',triple:'Tripla (reps, séries, carga)',greyskull:'Greyskull',time:'Por tempo'};
export const PROGRESSION_HINT:Record<Progression,string>={
 none:'Os alvos ficam como você definiu. Os pesos vêm do último treino.',
 linear:'Fez todas as reps em todas as séries? A carga sobe no próximo treino. Três treinos sem conseguir na mesma carga trazem um deload de 10%.',
 double:'Trabalhe dentro da faixa de reps. Quando chegar ao topo da faixa em todas as séries, a carga sobe e as reps voltam ao início.',
 triple:'Primeiro sobem as reps, depois entra uma série a mais, e só então a carga sobe.',
 greyskull:'A última série é até a falha técnica. Bateu o alvo, a carga sobe; com 10 reps ou mais, sobe o dobro. Não bateu, deload de 10%.',
 time:'Para exercícios por tempo: segurou o tempo em todas as séries, o alvo ganha 5 segundos.'};
export const ICONS=['dumbbell','push','pull','legs','core','cardio','full','stretch'] as const;
export type RoutineIcon=typeof ICONS[number];
export type Unit='kg'|'lb';
export type Effort='rir'|'rpe'|'off';
export type RoutineItem={id:string;exerciseId:string;sets:number;reps:number;repMax:number|null;timeSec:number|null;weight:number|null;restSec:number|null;superset:boolean;increment:number|null;progression:Progression|null;backupId:string|null;notes:string};
export type Routine={id:string;name:string;icon:RoutineIcon;progression:Progression;deload:boolean;items:RoutineItem[]};
export type Schedule={mode:'week'|'rotation';weekStart:'mon'|'sun';days:Record<Weekday,string|null>;rotation:string[];moved:Record<string,string|null>};
export type GymSettings={unit:Unit;effort:Effort;restSec:number;sound:boolean;vibrate:boolean;keepAwake:boolean};
export type CustomExercise={id:string;name:string;equipment:string;primary:string[];secondary:string[];category:string;timed:boolean};
export type GymProfile={v:1;routines:Routine[];schedule:Schedule;settings:GymSettings;favorites:string[];custom:CustomExercise[]};

export const LIMITS={routines:60,items:30,sets:20,reps:100,timeSec:7200,weight:1000,restSec:900,name:60,notes:300,favorites:500,custom:200,rotation:14,moved:60};
export class GymError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}

export const isDate=(v:unknown):v is string=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;};
export const isId=(v:unknown):v is string=>typeof v==='string'&&/^[\w-]{1,64}$/.test(v);
// Ids do catálogo (free-exercise-db) têm letras, números, _ - ( ) e vírgula; os próprios começam com "c-".
export const isExerciseId=(v:unknown):v is string=>typeof v==='string'&&/^[\w\-(),'&+]{1,90}$/.test(v);
const text=(v:unknown,max:number,label:string,required=false)=>{if(v===undefined||v===null||v==='')
 {if(required)throw new GymError(label+' é obrigatório.');return '';}if(typeof v!=='string')throw new GymError(label+' inválido.');const t=v.trim().replace(/\s+/g,' ');if(required&&!t)throw new GymError(label+' é obrigatório.');if(t.length>max)throw new GymError(label+' muito longo (até '+max+' caracteres).');return t;};
const int=(v:unknown,min:number,max:number,label:string)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw new GymError(label+': use um número de '+min+' a '+max+'.');return n;};
const optInt=(v:unknown,min:number,max:number,label:string)=>v===null||v===undefined||v===''?null:int(v,min,max,label);
// Peso com até duas casas (kg internamente), de 0 a 1000.
export const cleanWeight=(v:unknown,label='Peso')=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>LIMITS.weight)throw new GymError(label+': use de 0 a '+LIMITS.weight+'.');return Math.round(n*100)/100;};
const oneOf=<T extends string>(v:unknown,list:readonly T[],fallback:T):T=>list.includes(v as T)?v as T:fallback;
// Entrada vinda da rede ou do banco: um objeto qualquer, lido campo a campo.
export type Raw=Record<string,unknown>;
export const rec=(v:unknown):Raw=>v&&typeof v==='object'&&!Array.isArray(v)?v as Raw:{};

export const DEFAULT_SETTINGS:GymSettings={unit:'kg',effort:'rir',restSec:90,sound:true,vibrate:true,keepAwake:true};
export const emptySchedule=():Schedule=>({mode:'week',weekStart:'mon',days:{mon:null,tue:null,wed:null,thu:null,fri:null,sat:null,sun:null},rotation:[],moved:{}});
export const emptyProfile=():GymProfile=>({v:1,routines:[],schedule:emptySchedule(),settings:{...DEFAULT_SETTINGS},favorites:[],custom:[]});

export function cleanItem(input:unknown,known:(id:string)=>boolean):RoutineItem{const raw=rec(input);
 if(!input||typeof input!=='object')throw new GymError('Exercício inválido na rotina.');
 if(!isId(raw.id))throw new GymError('Exercício sem identificador.');
 if(!isExerciseId(raw.exerciseId)||!known(raw.exerciseId))throw new GymError('Exercício desconhecido: '+String(raw.exerciseId).slice(0,40)+'.');
 const reps=int(raw.reps??10,1,LIMITS.reps,'Repetições'),repMax=optInt(raw.repMax,1,LIMITS.reps,'Topo da faixa');
 if(repMax!==null&&repMax<reps)throw new GymError('O topo da faixa precisa ser maior que o início.');
 const backupId=raw.backupId?String(raw.backupId):null;if(backupId&&(!isExerciseId(backupId)||!known(backupId)))throw new GymError('Exercício reserva desconhecido.');
 const increment=raw.increment===null||raw.increment===undefined||raw.increment===''?null:cleanWeight(raw.increment,'Incremento');
 return {id:raw.id,exerciseId:raw.exerciseId,sets:int(raw.sets??3,1,LIMITS.sets,'Séries'),reps,repMax:repMax===reps?null:repMax,timeSec:optInt(raw.timeSec,5,LIMITS.timeSec,'Tempo (s)'),weight:cleanWeight(raw.weight),restSec:optInt(raw.restSec,0,LIMITS.restSec,'Descanso (s)'),
  superset:raw.superset===true,increment:increment===0?null:increment,progression:raw.progression==null?null:oneOf(raw.progression,PROGRESSIONS,'none'),backupId,notes:text(raw.notes,LIMITS.notes,'Nota')};}
export function cleanRoutine(input:unknown,known:(id:string)=>boolean):Routine{const raw=rec(input);
 if(!isId(raw.id))throw new GymError('Rotina inválida.');
 const items=Array.isArray(raw.items)?raw.items:[];if(items.length>LIMITS.items)throw new GymError('Uma rotina tem até '+LIMITS.items+' exercícios.');
 const clean=items.map((x:unknown)=>cleanItem(x,known));if(new Set(clean.map((x:RoutineItem)=>x.id)).size!==clean.length)throw new GymError('Exercício repetido na rotina.');
 // O primeiro exercício não pode estar "junto com o anterior".
 if(clean[0])clean[0].superset=false;
 return {id:raw.id,name:text(raw.name,LIMITS.name,'Nome da rotina',true),icon:oneOf(raw.icon,ICONS,'dumbbell'),progression:oneOf(raw.progression,PROGRESSIONS,'linear'),deload:raw.deload===true,items:clean};}
export function cleanSettings(input:unknown,base:GymSettings=DEFAULT_SETTINGS):GymSettings{const r=rec(input);
 return {unit:r.unit===undefined?base.unit:oneOf(r.unit,['kg','lb'] as const,base.unit),effort:r.effort===undefined?base.effort:oneOf(r.effort,['rir','rpe','off'] as const,base.effort),
  restSec:r.restSec===undefined?base.restSec:int(r.restSec,0,LIMITS.restSec,'Descanso padrão (s)'),sound:typeof r.sound==='boolean'?r.sound:base.sound,vibrate:typeof r.vibrate==='boolean'?r.vibrate:base.vibrate,keepAwake:typeof r.keepAwake==='boolean'?r.keepAwake:base.keepAwake};}
export function cleanCustom(input:unknown):CustomExercise{const raw=rec(input);
 if(typeof raw.id!=='string'||!/^c-[\w-]{1,60}$/.test(raw.id))throw new GymError('Exercício próprio inválido.');
 const list=(v:unknown)=>(Array.isArray(v)?v:[]).filter((x):x is string=>typeof x==='string'&&/^[a-z ]{2,20}$/.test(x)).slice(0,6);
 const primary=list(raw.primary);if(!primary.length)throw new GymError('Escolha pelo menos um músculo principal.');
 return {id:raw.id,name:text(raw.name,LIMITS.name,'Nome do exercício',true),equipment:typeof raw.equipment==='string'&&/^[a-z -]{2,20}$/.test(raw.equipment)?raw.equipment:'other',primary,secondary:list(raw.secondary).filter(x=>!primary.includes(x)),category:typeof raw.category==='string'&&/^[a-z ]{2,24}$/.test(raw.category)?raw.category:'strength',timed:raw.timed===true};}
function cleanSchedule(input:unknown,routineIds:Set<string>,base:Schedule):Schedule{const r=rec(input);const ref=(v:unknown)=>typeof v==='string'&&routineIds.has(v)?v:null;
 const days={...base.days},rd=rec(r.days);for(const d of WEEKDAYS)if(d in rd)days[d]=ref(rd[d]);
 const rotation=Array.isArray(r.rotation)?r.rotation.filter((x:unknown)=>typeof x==='string'&&routineIds.has(x)).slice(0,LIMITS.rotation):base.rotation;
 return {mode:r.mode===undefined?base.mode:oneOf(r.mode,['week','rotation'] as const,base.mode),weekStart:r.weekStart===undefined?base.weekStart:oneOf(r.weekStart,['mon','sun'] as const,base.weekStart),days,rotation,moved:base.moved};}
// Lê o documento gravado (ou vindo de um backup) e descarta o que não for válido, em vez de falhar o Gym inteiro.
export function readProfile(input:unknown):GymProfile{const p=emptyProfile(),raw=rec(input),ok=()=>true;
 p.routines=(Array.isArray(raw.routines)?raw.routines:[]).slice(0,LIMITS.routines).flatMap((r:unknown)=>{try{return [cleanRoutine(r,ok)];}catch{return [];}});
 const ids=new Set(p.routines.map(r=>r.id));p.schedule=cleanSchedule(raw.schedule,ids,p.schedule);
 for(const [d,v] of Object.entries(rec(rec(raw.schedule).moved)).slice(-LIMITS.moved))if(isDate(d))p.schedule.moved[d]=typeof v==='string'&&ids.has(v)?v:null;
 try{p.settings=cleanSettings(raw.settings);}catch{}
 p.favorites=(Array.isArray(raw.favorites)?raw.favorites:[]).filter(isExerciseId).slice(0,LIMITS.favorites);
 p.custom=(Array.isArray(raw.custom)?raw.custom:[]).slice(0,LIMITS.custom).flatMap((c:unknown)=>{try{return [cleanCustom(c)];}catch{return [];}});
 return p;}

export type StarterKey='ppl'|'upperLower'|'fullBody'|'fiveByFive';
export type ProfileCommand=
 |{type:'routine';routine:unknown}
 |{type:'deleteRoutine';id:string}
 |{type:'reorder';ids:string[]}
 |{type:'starter';key:StarterKey;seed:string}
 |{type:'schedule';schedule:Partial<Omit<Schedule,'days'|'moved'>>&{days?:Partial<Record<Weekday,string|null>>}}
 |{type:'move';date:string;routineId?:string|null}
 |{type:'settings';settings:Partial<GymSettings>}
 |{type:'favorite';exerciseId:string;on:boolean}
 |{type:'custom';exercise:unknown}
 |{type:'deleteCustom';id:string};
export type ProfileContext={known:(id:string)=>boolean;today:string;starter:(key:StarterKey,seed:string)=>{routines:Routine[];days:Partial<Record<Weekday,number>>}};

export function applyProfile(current:GymProfile,command:ProfileCommand,ctx:ProfileContext):GymProfile{
 if(!command||typeof command!=='object')throw new GymError('Comando inválido.');const p=structuredClone(current),c=command;
 const known=(id:string)=>ctx.known(id)||p.custom.some(x=>x.id===id);
 const dropRoutine=(id:string)=>{p.routines=p.routines.filter(r=>r.id!==id);for(const d of WEEKDAYS)if(p.schedule.days[d]===id)p.schedule.days[d]=null;p.schedule.rotation=p.schedule.rotation.filter(x=>x!==id);for(const [d,v] of Object.entries(p.schedule.moved))if(v===id)delete p.schedule.moved[d];};
 switch(c.type){
  case 'routine':{const r=cleanRoutine(c.routine,known);const i=p.routines.findIndex(x=>x.id===r.id);if(i>=0)p.routines[i]=r;else{if(p.routines.length>=LIMITS.routines)throw new GymError('Você chegou ao limite de '+LIMITS.routines+' rotinas.');p.routines.push(r);}return p;}
  case 'deleteRoutine':{if(!p.routines.some(r=>r.id===c.id))throw new GymError('Rotina não encontrada.',404);dropRoutine(c.id);return p;}
  case 'reorder':{if(!Array.isArray(c.ids))throw new GymError('Ordem inválida.');const pos=new Map<string,number>(c.ids.map((id:string,i:number)=>[id,i]));p.routines.sort((a,b)=>(pos.get(a.id)??1e9)-(pos.get(b.id)??1e9));return p;}
  case 'starter':{if(!['ppl','upperLower','fullBody','fiveByFive'].includes(c.key)||!isId(c.seed))throw new GymError('Plano inicial desconhecido.');
   const plan=ctx.starter(c.key,c.seed);if(p.routines.length+plan.routines.length>LIMITS.routines)throw new GymError('Você chegou ao limite de rotinas.');
   for(const r of plan.routines)p.routines.push(cleanRoutine(r,known));
   if(plan.routines.length){p.schedule.mode='week';for(const d of WEEKDAYS){const n=plan.days[d];p.schedule.days[d]=n===undefined?null:plan.routines[n].id;}p.schedule.rotation=plan.routines.map(r=>r.id);}
   return p;}
  case 'schedule':{p.schedule=cleanSchedule(c.schedule,new Set(p.routines.map(r=>r.id)),p.schedule);return p;}
  case 'move':{if(!isDate(c.date))throw new GymError('Data inválida.');
   if(c.routineId===undefined)delete p.schedule.moved[c.date];
   else{if(c.routineId!==null&&!p.routines.some(r=>r.id===c.routineId))throw new GymError('Rotina não encontrada.',404);p.schedule.moved[c.date]=c.routineId;}
   // Só guarda trocas de hoje em diante (e algumas recentes, para o histórico da semana).
   const keep=Object.keys(p.schedule.moved).sort().slice(-LIMITS.moved);p.schedule.moved=Object.fromEntries(keep.map(d=>[d,p.schedule.moved[d]]));return p;}
  case 'settings':{p.settings=cleanSettings(c.settings,p.settings);return p;}
  case 'favorite':{if(!isExerciseId(c.exerciseId))throw new GymError('Exercício inválido.');p.favorites=p.favorites.filter(x=>x!==c.exerciseId);if(c.on){if(!known(c.exerciseId))throw new GymError('Exercício desconhecido.');p.favorites.unshift(c.exerciseId);p.favorites=p.favorites.slice(0,LIMITS.favorites);}return p;}
  case 'custom':{const x=cleanCustom(c.exercise);const i=p.custom.findIndex(y=>y.id===x.id);if(i>=0)p.custom[i]=x;else{if(p.custom.length>=LIMITS.custom)throw new GymError('Você chegou ao limite de '+LIMITS.custom+' exercícios próprios.');p.custom.push(x);}return p;}
  case 'deleteCustom':{if(p.routines.some(r=>r.items.some(i=>i.exerciseId===c.id||i.backupId===c.id)))throw new GymError('Esse exercício está numa rotina. Tire-o de lá antes de excluir.');p.custom=p.custom.filter(x=>x.id!==c.id);p.favorites=p.favorites.filter(x=>x!==c.id);return p;}
 }
 throw new GymError('Comando desconhecido.');}

// Pesos ficam em kg; a tela mostra na unidade escolhida.
export const LB=0.45359237;
export const toUnit=(kg:number,unit:Unit)=>unit==='lb'?Math.round(kg/LB*10)/10:Math.round(kg*100)/100;
export const fromUnit=(v:number,unit:Unit)=>unit==='lb'?Math.round(v*LB*100)/100:Math.round(v*100)/100;
export const fmtWeight=(kg:number|null|undefined,unit:Unit)=>kg===null||kg===undefined?'–':toUnit(kg,unit).toLocaleString('pt-BR',{maximumFractionDigits:unit==='lb'?1:2})+' '+unit;
export const fmtNumber=(n:number,digits=1)=>n.toLocaleString('pt-BR',{maximumFractionDigits:digits});
export function weekdayOf(date:string):Weekday{const d=new Date(date+'T12:00:00Z').getUTCDay();return WEEKDAYS[(d+6)%7];}
export function shiftDate(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}

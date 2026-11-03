// Estatísticas do Gym: atividade do ano, evolução de um exercício, séries por músculo, esforço e recordes. Puro.
import {WEEKDAYS,shiftDate,type GymProfile,type CustomExercise} from './gym.ts';
import {volumeOf,type Workout} from './gym-active.ts';
import {exerciseOf} from './gym-catalog.ts';
import {e1rm,workSets} from './gym-stats.ts';
// Faixa de séries semanais por músculo que muita gente usa como referência para hipertrofia.
export const SET_RANGE:[number,number]=[10,20];
const chrono=(a:Workout,b:Workout)=>a.date.localeCompare(b.date)||a.startedAt.localeCompare(b.startedAt);

export type HeatDay={date:string;count:number;minutes:number;volume:number;future:boolean};
// Colunas de semanas (a mais antiga primeiro), do início da semana até hoje, por 52 semanas.
export function heatmap(workouts:Workout[],today:string,weekStart:'mon'|'sun'='mon',weeks=52){
 const byDate=new Map<string,HeatDay>();for(const w of workouts){const d=byDate.get(w.date)||{date:w.date,count:0,minutes:0,volume:0,future:false};d.count++;d.minutes+=w.durationMin;d.volume+=volumeOf(w);byDate.set(w.date,d);}
 const day=new Date(today+'T12:00:00Z').getUTCDay(),back=weekStart==='mon'?(day+6)%7:day,start=shiftDate(today,-back-(weeks-1)*7);
 const cols:HeatDay[][]=[];for(let c=0;c<weeks;c++){const col:HeatDay[]=[];for(let r=0;r<7;r++){const date=shiftDate(start,c*7+r);col.push(byDate.get(date)||{date,count:0,minutes:0,volume:0,future:date>today});}cols.push(col);}
 const max={minutes:Math.max(1,...[...byDate.values()].map(d=>d.minutes)),volume:Math.max(1,...[...byDate.values()].map(d=>d.volume))};return {cols,max};}

export type Point={date:string;top:number;reps:number;e1rm:number;volume:number;effort:number|null;timeSec:number};
// Uma ponto por treino com o exercício, do mais antigo ao mais novo: série mais pesada, melhor 1RM, volume e o esforço da série mais pesada.
export function seriesOf(workouts:Workout[],exerciseId:string):Point[]{return workouts.slice().sort(chrono).flatMap(w=>{const sets=workSets(w.exercises.filter(e=>e.exerciseId===exerciseId).flatMap(e=>e.sets));if(!sets.length)return [];
 const top=sets.reduce((a,b)=>(b.weight||0)>(a.weight||0)||((b.weight||0)===(a.weight||0)&&(b.reps||0)>(a.reps||0))?b:a);
 return [{date:w.date,top:top.weight||0,reps:top.reps||0,e1rm:Math.max(0,...sets.map(s=>e1rm(s.weight,s.reps))),volume:Math.round(sets.reduce((v,s)=>v+(s.weight||0)*(s.reps||0),0)),effort:top.effort,timeSec:Math.max(0,...sets.map(s=>s.timeSec||0))}];});}
// Exercícios que você mais faz (para escolher no gráfico), do mais frequente ao menos.
export function frequentExercises(workouts:Workout[]){const n=new Map<string,number>();for(const w of workouts)for(const id of new Set(w.exercises.map(e=>e.exerciseId)))n.set(id,(n.get(id)||0)+1);return [...n.entries()].sort((a,b)=>b[1]-a[1]).map(([id,count])=>({id,count}));}

// Séries feitas por músculo desde uma data (principal conta 1, secundário 0,5), em média por semana.
export function doneByMuscle(workouts:Workout[],since:string,today:string,custom:CustomExercise[]=[]){const score:Record<string,number>={};
 for(const w of workouts){if(w.date<since||w.date>today)continue;for(const e of w.exercises){const x=exerciseOf(e.exerciseId,custom);if(!x)continue;const n=workSets(e.sets).length;for(const m of x.primary)score[m]=(score[m]||0)+n;for(const m of x.secondary)score[m]=(score[m]||0)+n*.5;}}
 const weeks=Math.max(1,Math.round((Date.parse(today)-Date.parse(since))/6048e5));for(const k of Object.keys(score))score[k]=Math.round(score[k]/weeks*10)/10;return score;}
// Séries planejadas por semana: na semana fixa, a soma dos dias; na rotação, três treinos por semana seguindo a fila.
export function plannedByMuscle(p:GymProfile){const score:Record<string,number>={};const add=(id:string|null,times:number)=>{const r=p.routines.find(x=>x.id===id);if(!r)return;
  for(const it of r.items){const x=exerciseOf(it.exerciseId,p.custom);if(!x)continue;for(const m of x.primary)score[m]=(score[m]||0)+it.sets*times;for(const m of x.secondary)score[m]=(score[m]||0)+it.sets*times*.5;}};
 if(p.schedule.mode==='week')for(const d of WEEKDAYS)add(p.schedule.days[d],1);else{const list=p.schedule.rotation;for(const id of list)add(id,list.length?3/list.length:0);}
 for(const k of Object.keys(score))score[k]=Math.round(score[k]*10)/10;return score;}

export type EffortSummary={rated:number;total:number;avg:number|null;hard:number;buckets:[label:string,count:number][]};
// Esforço desde uma data: RIR médio, parte das séries a 3 ou menos da falha e a distribuição.
export function effortSummary(workouts:Workout[],since:string):EffortSummary{const sets=workouts.filter(w=>w.date>=since).flatMap(w=>w.exercises.flatMap(e=>workSets(e.sets)));const rated=sets.filter(s=>s.effort!==null) as {effort:number}[];
 const b:[string,number][]=[['Falha (0)',0],['1',0],['2',0],['3',0],['4+',0]];for(const s of rated)b[s.effort<=0?0:s.effort<=1?1:s.effort<=2?2:s.effort<=3?3:4][1]++;
 return {rated:rated.length,total:sets.length,avg:rated.length?Math.round(rated.reduce((v,s)=>v+s.effort,0)/rated.length*10)/10:null,hard:rated.length?Math.round(rated.filter(s=>s.effort<=3).length/rated.length*100):0,buckets:b};}

export type RecordEvent={date:string;workoutId:string;exerciseId:string;weight:number;reps:number;e1rm:number;timeSec:number};
// Cada vez que um exercício passou da melhor marca anterior (a primeira sessão só marca a base), do mais novo ao mais antigo.
export function recordTimeline(workouts:Workout[]):RecordEvent[]{const best=new Map<string,{e1rm:number;weight:number;reps:number;timeSec:number}>();const out:RecordEvent[]=[];
 for(const w of workouts.slice().sort(chrono))for(const id of new Set(w.exercises.map(e=>e.exerciseId))){const sets=workSets(w.exercises.filter(e=>e.exerciseId===id).flatMap(e=>e.sets));if(!sets.length)continue;
  const top=sets.map(s=>({weight:s.weight||0,reps:s.reps||0,e1rm:e1rm(s.weight,s.reps),timeSec:s.timeSec||0})).sort((a,b)=>b.e1rm-a.e1rm||b.weight-a.weight||b.reps-a.reps||b.timeSec-a.timeSec)[0];const prev=best.get(id);
  if(!prev){best.set(id,top);continue;}
  const beat=top.e1rm>0?top.e1rm>prev.e1rm||top.weight>prev.weight:!top.weight&&!prev.weight&&(top.reps>prev.reps||top.timeSec>prev.timeSec);
  if(beat){out.push({date:w.date,workoutId:w.id,exerciseId:id,...top});best.set(id,{e1rm:Math.max(prev.e1rm,top.e1rm),weight:Math.max(prev.weight,top.weight),reps:Math.max(prev.reps,top.reps),timeSec:Math.max(prev.timeSec,top.timeSec)});}}
 return out.reverse();}
// Melhor sequência de semanas seguidas com treino, em todo o histórico.
export function bestWeekStreak(dates:string[],weekStart:'mon'|'sun'='mon'){const startOf=(d:string)=>{const day=new Date(d+'T12:00:00Z').getUTCDay();return shiftDate(d,-(weekStart==='mon'?(day+6)%7:day));};
 const weeks=[...new Set(dates.map(startOf))].sort();let best=0,run=0,prev='';for(const w of weeks){run=prev&&shiftDate(prev,7)===w?run+1:1;best=Math.max(best,run);prev=w;}return best;}

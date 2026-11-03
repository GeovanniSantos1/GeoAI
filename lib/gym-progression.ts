// Motor de progressão: o alvo de cada exercício no próximo treino e o porquê, a partir das últimas sessões. Puro.
import type {Progression,RoutineItem} from './gym.ts';
import type {Target} from './gym-active.ts';
import {workSets,type Session} from './gym-stats.ts';
import {fmtNumber} from './gym.ts';
export const STALL_LIMIT=3,DELOAD=0.9,TIME_STEP=5;
const roundTo=(v:number,step:number)=>step>0?Math.round(Math.round(v/step)*step*100)/100:Math.round(v*100)/100;
const kg=(v:number)=>fmtNumber(v,2)+' kg';
type Plan=Pick<RoutineItem,'sets'|'reps'|'repMax'|'timeSec'|'weight'>;
// Sessões que contam: as que não foram marcadas como "não contar" (deload, treino de teste).
const counted=(s:Session[])=>s.filter(x=>!x.noProgression);
const topWeight=(s:Session)=>Math.max(0,...workSets(s.sets).map(x=>x.weight||0));
// A sessão bateu o alvo quando fez pelo menos as séries planejadas e cada uma chegou às reps (ou ao tempo).
export function hit(s:Session,goalReps:number,goalSets:number,timeSec:number|null){const w=workSets(s.sets).filter(x=>x.kind==='work');if(w.length<goalSets)return false;
 return w.slice(0,goalSets).every(x=>timeSec?(x.timeSec||0)>=timeSec:(x.reps||0)>=goalReps);}
// Treinos seguidos na mesma carga sem bater o alvo (uma troca de carga começa a contagem de novo).
export function stalls(sessions:Session[],goalReps:number,goalSets:number,timeSec:number|null){if(!sessions.length)return 0;const w0=topWeight(sessions[0]);let n=0;
 for(const s of sessions){if(topWeight(s)!==w0||hit(s,goalReps,goalSets,timeSec))break;n++;}return n;}

export function nextTarget(item:Plan,rule:Progression,history:Session[],increment:number):Target{
 const sessions=counted(history),last=sessions[0];const base={sets:item.sets,reps:item.reps,repMax:item.repMax,timeSec:item.timeSec,weight:item.weight,why:'',deload:false};
 if(!last){return {...base,why:item.weight?'Primeiro treino: comece com '+kg(item.weight)+' e ajuste se precisar.':'Primeiro treino: escolha uma carga que você faça com boa técnica.'};}
 const lastW=topWeight(last)||item.weight||0,work=workSets(last.sets).filter(x=>x.kind==='work');
 const withWeight=(w:number)=>roundTo(Math.max(0,w),increment||0.5);
 if(rule==='none')return {...base,weight:lastW||item.weight,why:'Mesma carga da última vez.'};
 if(rule==='time'||item.timeSec){const t=item.timeSec||30;const lastT=Math.max(0,...work.map(x=>x.timeSec||0));
  if(rule==='time'&&hit(last,0,item.sets,Math.max(t,lastT))&&lastT>=t)return {...base,timeSec:Math.min(7200,Math.max(t,lastT)+TIME_STEP),weight:lastW||null,why:'Segurou o tempo em todas as séries: +'+TIME_STEP+' s.'};
  return {...base,timeSec:Math.max(t,lastT)||t,weight:lastW||null,why:rule==='time'?'Segure '+(Math.max(t,lastT)||t)+' s em todas as séries para ganhar mais 5 s.':'Mesmo tempo da última vez.'};}
 const deloadCheck=(goalReps:number,goalSets:number)=>{const n=stalls(sessions,goalReps,goalSets,null);return n>=STALL_LIMIT&&increment>0?withWeight(lastW*DELOAD):null;};
 if(rule==='linear'){if(!increment)return progressReps(base,last,'Peso corporal: tente uma rep a mais em cada série.');
  if(hit(last,item.reps,item.sets,null))return {...base,weight:withWeight(lastW+increment),why:'Todas as reps da última vez: +'+kg(increment)+'.'};
  const d=deloadCheck(item.reps,item.sets);if(d!==null)return {...base,weight:d,deload:true,why:STALL_LIMIT+' treinos sem bater as reps em '+kg(lastW)+': deload de 10% para pegar embalo.'};
  return {...base,weight:lastW,why:'Faltaram reps da última vez: repita '+kg(lastW)+'.'};}
 if(rule==='double'){const top=item.repMax||item.reps;
  if(hit(last,top,item.sets,null)){if(!increment)return {...base,reps:top,why:'Topo da faixa em todas as séries. Sem carga para somar: mantenha as reps e acrescente uma série quando quiser.'};return {...base,weight:withWeight(lastW+increment),reps:item.reps,why:'Chegou a '+top+' reps em todas as séries: +'+kg(increment)+' e volta para '+item.reps+'.'};}
  const d=deloadCheck(item.reps,item.sets);if(d!==null)return {...base,weight:d,deload:true,why:STALL_LIMIT+' treinos abaixo do início da faixa: deload de 10%.'};
  const lowest=Math.min(...work.slice(0,item.sets).map(x=>x.reps||0),top);const goal=Math.min(top,Math.max(item.reps,lowest+1));
  return {...base,weight:lastW,reps:goal,why:'Faixa '+item.reps+'–'+top+': busque '+goal+' reps em todas as séries com '+kg(lastW)+'.'};}
 if(rule==='triple'){const top=item.repMax||item.reps+4,maxSets=item.sets+2,setsDone=work.length;const doneSets=Math.max(item.sets,Math.min(maxSets,setsDone));
  if(hit(last,top,doneSets,null)){if(doneSets<maxSets)return {...base,sets:doneSets+1,reps:item.reps,weight:lastW,why:'Topo das reps em '+doneSets+' séries: agora '+(doneSets+1)+' séries de '+item.reps+'.'};
   return {...base,sets:item.sets,reps:item.reps,weight:withWeight(lastW+increment),why:'Reps e séries no máximo: +'+kg(increment)+', voltando a '+item.sets+' × '+item.reps+'.'};}
  const lowest=Math.min(...work.slice(0,doneSets).map(x=>x.reps||0),top);return {...base,sets:doneSets,weight:lastW,reps:Math.min(top,Math.max(item.reps,lowest+1)),why:'Suba as reps até '+top+' em '+doneSets+' séries antes de mudar.'};}
 if(rule==='greyskull'){const amrap=work[work.length-1]?.reps||0,straight=work.slice(0,-1).every(x=>(x.reps||0)>=item.reps);
  if(straight&&amrap>=item.reps){const step=amrap>=10?increment*2:increment;return {...base,weight:withWeight(lastW+step),why:'Última série com '+amrap+' reps: +'+kg(step)+(amrap>=10?' (o dobro, por passar de 10).':'.')};}
  return {...base,weight:withWeight(lastW*DELOAD),deload:true,why:'Não bateu o alvo: deload de 10% e a última série segue até a falha técnica.'};}
 return {...base,weight:lastW,why:''};}
function progressReps(base:Target,last:Session,why:string):Target{const lowest=Math.min(...workSets(last.sets).map(x=>x.reps||0));return {...base,weight:null,reps:Math.max(base.reps,lowest+1),why};}

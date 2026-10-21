import type {Item} from './types.ts';
import {donePomodoros,type Card} from './board.ts';
// Plano do dia montado por regra (como no FocoFlow): funciona sem IA, e o assistente usa a mesma função.
export type PlanCard=Pick<Card,'id'|'number'|'title'|'status'|'priority'|'dueDate'|'estimate'>;
export type PlanItem={cardId:string;pomodoros:number;reason:string};
export type DayPlan={available:number;items:PlanItem[];removed:string[]};
export const emptyPlan=(available=8):DayPlan=>({available,items:[],removed:[]});
const WEIGHT={critical:40,high:25,medium:10,low:0};
const diff=(a:string,b:string)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
export function cardScore(c:PlanCard,today:string){let score=WEIGHT[c.priority];const reasons:string[]=[];
 if(c.dueDate){const d=diff(today,c.dueDate);if(d<0){score+=50+5*Math.min(-d,10);reasons.push('atrasado há '+(-d)+(d===-1?' dia':' dias'));}else if(d===0){score+=35;reasons.push('prazo hoje');}else if(d===1){score+=25;reasons.push('prazo amanhã');}else if(d<=3){score+=12;reasons.push('prazo em '+d+' dias');}}
 if(c.priority==='critical')reasons.push('prioridade crítica');else if(c.priority==='high')reasons.push('prioridade alta');
 if(c.status==='doing'){score+=15;reasons.push('já em andamento');}if(c.status==='backlog')score-=20;
 return {score,reason:reasons.join(' · ')||'próximo da fila'};}
// Os itens do usuário vêm primeiro, na ordem e com os pomodoros dele; o que ele removeu não volta no dia.
export function buildDayPlan(cards:PlanCard[],sessions:Item[],plan:DayPlan,available:number,today:string):DayPlan{
 const cap=clamp(Math.floor(available)||1,1,16),removed=new Set(plan.removed);
 const candidates=new Map(cards.filter(c=>['backlog','todo','doing'].includes(c.status)&&!removed.has(c.id)).map(c=>[c.id,c]));
 const items:PlanItem[]=[];let total=0;
 for(const it of plan.items){const c=candidates.get(it.cardId);if(!c||total+it.pomodoros>cap)continue;items.push({...it,reason:cardScore(c,today).reason});total+=it.pomodoros;candidates.delete(c.id);}
 const rest=[...candidates.values()].map(c=>({c,...cardScore(c,today)})).sort((a,b)=>b.score-a.score||(a.c.dueDate??'9999').localeCompare(b.c.dueDate??'9999')||a.c.number-b.c.number);
 for(const r of rest){const p=clamp(r.c.estimate-donePomodoros(sessions,r.c.id),1,4);if(total+p>cap)continue;items.push({cardId:r.c.id,pomodoros:p,reason:r.reason});total+=p;}
 return {available:cap,items,removed:plan.removed};}
export function planProgress(plan:DayPlan,sessions:Item[],today:string):Record<string,number>{const out:Record<string,number>={};
 for(const it of plan.items)out[it.cardId]=sessions.filter(x=>x.boardCardId===it.cardId&&x.date===today&&(x.kind??'focus')==='focus'&&(x.status??'completed')==='completed').length;return out;}
// Card excluído depois de entrar no plano some do plano em vez de impedir a gravação.
export function cleanPlan(input:unknown,cardIds?:Set<string>):DayPlan{if(!input||typeof input!=='object')throw new Error('Plano inválido.');const raw=input as Record<string,unknown>;
 const available=raw.available;if(typeof available!=='number'||!Number.isInteger(available)||available<1||available>16)throw new Error('Disponíveis deve ficar entre 1 e 16.');
 const items=Array.isArray(raw.items)?raw.items:[];if(items.length>16)throw new Error('O plano tem no máximo 16 itens.');const seen=new Set<string>(),clean:PlanItem[]=[];
 for(const x of items){if(typeof x?.cardId!=='string'||!/^[\w-]{1,64}$/.test(x.cardId))throw new Error('Card do plano inválido.');if(seen.has(x.cardId))throw new Error('Card repetido no plano.');seen.add(x.cardId);
  if(!Number.isInteger(x.pomodoros)||x.pomodoros<1||x.pomodoros>4)throw new Error('Use de 1 a 4 pomodoros por item.');if(cardIds&&!cardIds.has(x.cardId))continue;clean.push({cardId:x.cardId,pomodoros:x.pomodoros,reason:typeof x.reason==='string'?x.reason.slice(0,200):''});}
 const list:unknown[]=Array.isArray(raw.removed)?raw.removed:[],removed=[...new Set(list.filter((x):x is string=>typeof x==='string'&&/^[\w-]{1,64}$/.test(x)))].slice(0,200);
 return {available,items:clean,removed};}

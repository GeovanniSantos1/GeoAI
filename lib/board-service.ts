import {todayInZone,addDays} from './core.ts';
import {BoardError,newCard,updateCard,createdEvent,summarize,cleanFields,planAction,searchCards,parseCode,reviveCard,reviveEvent,reviveAudit,codeOf,CARD_LIMIT,LIMITS,type Card,type CardFilters,type AuditEntry,type BoardEvent,type Actor,type ChangeSet,storeProposal,decideProposal,parseArea,parsePriority,STALE_PROPOSAL} from './board.ts';
import {buildDayPlan,cleanPlan,emptyPlan,type DayPlan} from './day-plan.ts';
import {focusReport} from './focus-report.ts';
import {FOCUS_BUSY} from './focus.ts';
import {StoreConflict,type BoardStore} from './board-store.ts';
import type {Command,Workspace} from './types.ts';
// Casos de uso do quadro com dependências injetadas: as rotas ligam o Postgres e a IA; os testes usam o banco em memória.
export type TriageSuggestion={cardId:string;area:string;priority:string;estimate:number};
export type BoardAi={refine:(input:{card:Card;instruction:string})=>Promise<unknown>;tests:(input:{card:Card;instruction:string})=>Promise<unknown>;triage:(input:{cards:Card[]},onItem:(s:TriageSuggestion)=>void)=>Promise<void>};
export type BoardDeps={userId:string;store:BoardStore;load:()=>Promise<{state:Workspace;version:number}>;mutate:(command:Command)=>Promise<{state:Workspace;version:number}>;quota:(kind:'board_ai',day:string)=>Promise<boolean>;ai:BoardAi|null;now?:()=>Date};
export const CARD_CHANGED='Este card foi atualizado em outra aba.';
export const AI_OFF='A IA não está configurada neste GeoAI.';
export const AI_QUOTA='Você usou as 40 ações de IA de hoje. Amanhã tem mais.';
export const AI_FAILED='A IA não respondeu. Tente de novo.';
const clock=(d:BoardDeps)=>d.now?d.now():new Date();
const DAY=/^\d{4}-\d{2}-\d{2}$/;
// Corpo do pedido lido como registro; cada função valida o que usa.
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const idOf=(v:unknown)=>{const id=rec(v).id;return typeof id==='string'?id:null;};
async function context(d:BoardDeps){const {state}=await d.load();return {state,today:todayInZone(state.profile.timezone,clock(d))};}
async function mustCard(d:BoardDeps,id:string){const c=typeof id==='string'?await d.store.card(d.userId,id):null;if(!c)throw new BoardError('Card não encontrado.',404);return c;}
// Duas abas gravando juntas: relê o banco e tenta de novo, até 3 vezes.
async function retry<T>(run:()=>Promise<T>):Promise<T>{for(let i=0;;i++){try{return await run();}catch(e){if(!(e instanceof StoreConflict)||i>=2)throw e;}}}

export async function listBoard(d:BoardDeps,archived=false){const all=await d.store.cards(d.userId);
 const list=archived?all.filter(c=>c.status==='archived').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,200):all.filter(c=>c.status!=='archived');
 return {cards:list.map(summarize),archivedCount:all.filter(c=>c.status==='archived').length};}
export async function cardDetail(d:BoardDeps,id:string){const card=await mustCard(d,id);return {card,events:await d.store.events(d.userId,id,100)};}
export async function findCard(d:BoardDeps,code:unknown){const n=parseCode(code),c=n===null?undefined:(await d.store.cards(d.userId)).find(x=>x.number===n);if(!c)throw new BoardError((n===null?String(code).slice(0,20):'#'+n)+' não existe.',404);return c;}
export async function createCards(d:BoardDeps,inputs:unknown,actor:Actor='you'){const list:unknown[]=Array.isArray(inputs)?inputs:[];if(!list.length||list.length>LIMITS.perAction)throw new BoardError('Crie de 1 a 20 cards por vez.');
 return retry(async()=>{const all=await d.store.cards(d.userId),ids=new Set(all.map(c=>c.id));
  // Confirmar de novo a mesma sugestão (Telegram, WhatsApp) não duplica: o id da sugestão vira o id do card.
  const fresh=list.filter(x=>{const id=idOf(x);return !(id&&ids.has(id));}),existing=all.filter(c=>list.some(x=>idOf(x)===c.id));
  if(all.length+fresh.length>LIMITS.cards)throw new BoardError(CARD_LIMIT);const at=clock(d).toISOString();let n=all.reduce((m,c)=>Math.max(m,c.number),0);
  const created=fresh.map(x=>newCard(x,++n,at));if(created.length)await d.store.save(d.userId,{created,events:created.map(c=>createdEvent(c,actor,at))});return {cards:[...existing,...created]};});}
export async function patchCard(d:BoardDeps,id:string,raw:unknown){const card=await mustCard(d,id),body=rec(raw);if(typeof body.rev!=='number'||!Number.isInteger(body.rev))throw new BoardError('Revisão do card ausente.');if(body.rev!==card.rev)throw new BoardError(CARD_CHANGED,409);
 const fields={...body};delete fields.rev;const r=updateCard(card,cleanFields(fields,card),'you',clock(d).toISOString());if(r.card===card)return {card};
 try{await d.store.save(d.userId,{updated:[r.card],events:r.events});}catch(e){if(e instanceof StoreConflict)throw new BoardError(CARD_CHANGED,409);throw e;}return {card:r.card};}
export async function deleteCard(d:BoardDeps,id:string){if(typeof id!=='string'||!await d.store.remove(d.userId,id))throw new BoardError('Card não encontrado.',404);return {ok:true as const};}
// Iniciar um card: primeiro o timer (é o que a pessoa pediu); depois o card vai para Em andamento.
export async function startCard(d:BoardDeps,id:string,opts:{minutes?:number;replace?:boolean}={},actor:Actor='you'){
 const card=await mustCard(d,id);if(card.status==='done'||card.status==='archived')throw new BoardError('Reabra o card para iniciar um pomodoro.');
 let r:{state:Workspace;version:number};
 try{r=await d.mutate({type:'focus',action:'start',kind:'focus',boardCardId:card.id,code:codeOf(card),title:card.title,...(opts.minutes!==undefined?{minutes:opts.minutes}:{}),replace:!!opts.replace});}
 catch(e){if(e instanceof Error&&e.message===FOCUS_BUSY)throw new BoardError(FOCUS_BUSY,409);throw e;}
 let current=card;
 for(let i=0;i<2&&(current.status==='backlog'||current.status==='todo');i++){const u=updateCard(current,{status:'doing'},actor,clock(d).toISOString());try{await d.store.save(d.userId,{updated:[u.card],events:u.events});current=u.card;}catch(e){if(!(e instanceof StoreConflict))throw e;current=await mustCard(d,id);}}
 return {...r,card:current};}
export async function previewAction(d:BoardDeps,tool:string,args:Record<string,unknown>):Promise<ChangeSet>{return planAction(tool,args,await d.store.cards(d.userId),'approved',clock(d).toISOString()).set;}
export async function applyAction(d:BoardDeps,tool:string,args:Record<string,unknown>,actor:Actor){return retry(async()=>{const at=clock(d).toISOString(),p=planAction(tool,args,await d.store.cards(d.userId),actor,at);
 if(!p.set.canApply)throw Object.assign(new BoardError(p.set.errors[0]||p.set.notes[0]||'Nada para aplicar.',409),{set:p.set});
 const audit:AuditEntry={id:crypto.randomUUID(),at,tool:p.set.tool,changes:p.set.changes};await d.store.save(d.userId,{created:p.created,updated:p.updated,events:p.events,audit});return {set:p.set};});}
export async function getPlan(d:BoardDeps,date?:string|null){const {today}=await context(d);const day=date&&DAY.test(date)?date:today;return {date:day,plan:await d.store.plan(d.userId,day)??emptyPlan()};}
export async function putPlan(d:BoardDeps,date:string,raw:unknown){if(!DAY.test(date))throw new BoardError('Data inválida.');const ids=new Set((await d.store.cards(d.userId)).map(c=>c.id));let plan:DayPlan;
 try{plan=cleanPlan(raw,ids);}catch(e){throw new BoardError(e instanceof Error?e.message:'Plano inválido.');}await d.store.putPlan(d.userId,date,plan);return {date,plan};}
export async function buildPlan(d:BoardDeps,available:number){const {state,today}=await context(d);const current=await d.store.plan(d.userId,today)??emptyPlan();
 const plan=buildDayPlan(await d.store.cards(d.userId),state.focusSessions,current,available,today);await d.store.putPlan(d.userId,today,plan);return {date:today,plan};}
export async function listAudit(d:BoardDeps){return {entries:await d.store.audit(d.userId,100)};}
export async function searchBoard(d:BoardDeps,filters:CardFilters){const {state,today}=await context(d);return searchCards(await d.store.cards(d.userId),filters||{},today,state.clients);}
export async function boardReport(d:BoardDeps,start:string,end:string){if(!DAY.test(start)||!DAY.test(end))throw new BoardError('Use datas no formato AAAA-MM-DD.');const {state}=await context(d);
 try{return focusReport(state.focusSessions,await d.store.cards(d.userId),start,end);}catch(e){throw new BoardError(e instanceof Error?e.message:'Período inválido');}}
// Backup em pedaços: até 200 cards, com os últimos 100 eventos de cada um, e no máximo uns 3 MB por resposta (o limite da Vercel é 4,5 MB).
const PIECE=200,BUDGET=3_000_000;
export async function exportBoard(d:BoardDeps,after:number){if(!Number.isInteger(after)||after<0)throw new BoardError('Pedaço inválido.');
 const all=(await d.store.cards(d.userId)).filter(c=>c.number>after).sort((a,b)=>a.number-b.number),batch=all.slice(0,PIECE),byCard=new Map<string,BoardEvent[]>();
 for(const e of await d.store.eventsOf(d.userId,batch.map(c=>c.id))){const list=byCard.get(e.cardId)??[];list.push(e);byCard.set(e.cardId,list);}
 const cards:Card[]=[],events:BoardEvent[]=[];let size=0;
 for(const c of batch){const evs=(byCard.get(c.id)??[]).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,100),s=JSON.stringify(c).length+JSON.stringify(evs).length;if(cards.length&&size+s>BUDGET)break;cards.push(c);events.push(...evs);size+=s;}
 const first=after===0,today=first?(await context(d)).today:'';
 return {cards,events,audit:first?await d.store.audit(d.userId,100):[],plans:first?await d.store.plans(d.userId,addDays(today,-30)):[],next:cards.length<all.length?cards[cards.length-1].number:null};}
export async function importBoard(d:BoardDeps,input:unknown){const raw=rec(input);if(!Array.isArray(raw.cards)||raw.cards.length>LIMITS.perImport)throw new BoardError('Backup do quadro inválido.');const at=clock(d).toISOString();
 const cards:Card[]=raw.cards.map((c:unknown)=>reviveCard(c,at)),ids=new Set(cards.map(c=>c.id));if(ids.size!==cards.length||new Set(cards.map(c=>c.number)).size!==cards.length)throw new BoardError('Backup do quadro inválido.');
 const events=(Array.isArray(raw.events)?raw.events:[]).map(reviveEvent).filter((e:BoardEvent|null):e is BoardEvent=>!!e&&ids.has(e.cardId));
 const audit=(Array.isArray(raw.audit)?raw.audit:[]).slice(0,100).map(reviveAudit).filter((a:AuditEntry|null):a is AuditEntry=>!!a);
 const plans=(Array.isArray(raw.plans)?raw.plans:[]).slice(0,60).flatMap((input:unknown)=>{const p=rec(input);try{return typeof p.date==='string'&&DAY.test(p.date)?[{date:p.date,data:cleanPlan(p.data)}]:[];}catch{return [];}});
 if(raw.replace!==true&&(await d.store.cards(d.userId)).length+cards.length>LIMITS.cards)throw new BoardError(CARD_LIMIT);
 try{await d.store.restore(d.userId,{cards,events,audit,plans},raw.replace===true);}catch(e){if(e instanceof StoreConflict)throw new BoardError('Backup do quadro inválido.');throw e;}return {ok:true as const,cards:cards.length};}
export async function clearBoard(d:BoardDeps){await d.store.clear(d.userId);return {ok:true as const};}
// IA no card: a cota é gasta antes de chamar o modelo; a proposta guarda a revisão que a IA viu (baseRev).
export async function generateProposal(d:BoardDeps,id:string,raw:unknown){const body=rec(raw),action=body.action;if(action!=='refine'&&action!=='tests')throw new BoardError('Ação de IA inválida.');
 const instruction=typeof body.instruction==='string'?body.instruction.trim().slice(0,LIMITS.instruction):'';if(!d.ai)throw new BoardError(AI_OFF,503);
 const card=await mustCard(d,id);const {today}=await context(d);if(!await d.quota('board_ai',today))throw new BoardError(AI_QUOTA,429);
 let out:unknown;try{out=await (action==='refine'?d.ai.refine({card,instruction}):d.ai.tests({card,instruction}));}catch{throw new BoardError(AI_FAILED,502);}
 const proposal=storeProposal(card,action,out,instruction,clock(d).toISOString()).proposals[action];
 const fresh=await mustCard(d,id),proposals={...fresh.proposals,[action]:proposal};await d.store.setProposals(d.userId,id,proposals);return {card:{...fresh,proposals}};}
export async function decideCardProposal(d:BoardDeps,id:string,raw:unknown){const body=rec(raw),action=body.action,decision=body.decision;
 if((action!=='refine'&&action!=='tests')||(decision!=='accept'&&decision!=='reject'))throw new BoardError('Decisão inválida.');
 const card=await mustCard(d,id),r=decideProposal(card,action,decision,Array.isArray(body.selected)?body.selected:undefined,clock(d).toISOString());
 if(decision==='reject'){await d.store.setProposals(d.userId,id,r.card.proposals);return {card:r.card};}
 try{await d.store.save(d.userId,{updated:[r.card],events:r.events,audit:r.audit});}catch(e){if(e instanceof StoreConflict)throw new BoardError(STALE_PROPOSAL,409);throw e;}return {card:r.card};}
// Triagem: a validação e a cota vêm antes da resposta em streaming, para os erros voltarem com o status certo.
export async function prepareTriage(d:BoardDeps,raw:unknown){if(!d.ai)throw new BoardError(AI_OFF,503);const body=rec(raw);
 const ids:string[]=Array.isArray(body.cardIds)?[...new Set<string>(body.cardIds.filter((x:unknown):x is string=>typeof x==='string'))]:[];if(!ids.length||ids.length>LIMITS.perAction)throw new BoardError('Trie de 1 a 20 cards por vez.');
 const cards=(await d.store.cards(d.userId)).filter(c=>ids.includes(c.id)&&c.status==='backlog'&&c.estimate===0);if(!cards.length)throw new BoardError('Nenhum card novo para triar.');
 const {today}=await context(d);if(!await d.quota('board_ai',today))throw new BoardError(AI_QUOTA,429);return cards;}
// Sugestões de outros cards, repetidas ou com valores inválidos são ignoradas; a estimativa fica entre 1 e 12.
export async function runTriage(d:BoardDeps,cards:Card[],onItem:(s:TriageSuggestion)=>void){if(!d.ai)throw new BoardError(AI_OFF,503);const pending=new Set(cards.map(c=>c.id));
 await d.ai.triage({cards},s=>{if(!s||!pending.has(s.cardId))return;const area=parseArea(s.area),priority=parsePriority(s.priority);if(!area||!priority||!Number.isFinite(s.estimate))return;
  pending.delete(s.cardId);onItem({cardId:s.cardId,area,priority,estimate:Math.min(12,Math.max(1,Math.round(s.estimate)))});});}

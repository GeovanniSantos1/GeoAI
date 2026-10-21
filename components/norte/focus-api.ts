'use client';
import type {Card,CardSummary,BoardEvent,AuditEntry,ChangeSet} from '@/lib/board';import type {DayPlan} from '@/lib/day-plan';import type {Workspace} from '@/lib/types';
// Chamadas às rotas do Foco. Um erro vira ApiError, com a mensagem da rota (em pt-BR), o status e o corpo.
export type ErrorBody={error?:string;set?:{errors?:string[];notes?:string[]}};
export class ApiError extends Error{status:number;body:ErrorBody;constructor(message:string,status:number,body:ErrorBody){super(message);this.status=status;this.body=body;}}
async function api<T>(url:string,method='GET',body?:unknown):Promise<T>{const r=await fetch(url,{method,cache:'no-store',...(body!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 let j:unknown={};try{j=await r.json();}catch{}if(!r.ok){const b=(j&&typeof j==='object'?j:{}) as ErrorBody;throw new ApiError(b.error||'Não foi possível concluir agora.',r.status,b);}return j as T;}
export type StateResult={state:Workspace;version:number};
export type BoardList={cards:CardSummary[];archivedCount:number};
export type BackupPiece={cards:Card[];events:BoardEvent[];audit:AuditEntry[];plans:{date:string;data:DayPlan}[];next:number|null};
const card=(id:string)=>'/api/foco/cards/'+encodeURIComponent(id);
export const foco={
 board:(archived=false)=>api<BoardList>('/api/foco/board'+(archived?'?archived=1':'')),
 create:(cards:unknown[])=>api<{cards:Card[]}>('/api/foco/cards','POST',{cards}),
 card:(id:string)=>api<{card:Card;events:BoardEvent[]}>(card(id)),
 patch:(id:string,rev:number,fields:Record<string,unknown>)=>api<{card:Card}>(card(id),'PATCH',{rev,...fields}),
 remove:(id:string)=>api<{ok:true}>(card(id),'DELETE'),
 start:(id:string,replace=false)=>api<StateResult&{card:Card}>(card(id)+'/start','POST',{replace}),
 ai:(id:string,action:'refine'|'tests',instruction:string)=>api<{card:Card}>(card(id)+'/ai','POST',{action,instruction}),
 decide:(id:string,action:'refine'|'tests',decision:'accept'|'reject',selected?:number[])=>api<{card:Card}>(card(id)+'/proposal','POST',{action,decision,...(selected?{selected}:{})}),
 apply:(tool:string,args:unknown)=>api<{set:ChangeSet}>('/api/foco/apply','POST',{tool,args}),
 plan:(date?:string)=>api<{date:string;plan:DayPlan}>('/api/foco/plan'+(date?'?date='+date:'')),
 putPlan:(date:string,plan:DayPlan)=>api<{date:string;plan:DayPlan}>('/api/foco/plan?date='+date,'PUT',plan),
 audit:()=>api<{entries:AuditEntry[]}>('/api/foco/audit'),
 exportPiece:(after:number)=>api<BackupPiece>('/api/foco/export?after='+after),
 importPiece:(body:{replace:boolean;cards:unknown[];events?:unknown[];audit?:unknown[];plans?:unknown[]})=>api<{ok:true;cards:number}>('/api/foco/import','POST',body),
 state:()=>api<StateResult>('/api/state'),
};
// A triagem chega como NDJSON: uma linha por card triado, conforme a IA responde.
export async function triageStream(cardIds:string[],onItem:(s:{cardId:string;area:string;priority:string;estimate:number})=>void){
 const r=await fetch('/api/foco/triage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cardIds})});
 if(!r.ok||!r.body){let j:ErrorBody={};try{j=await r.json() as ErrorBody;}catch{}throw new ApiError(j.error||'Não foi possível triar agora.',r.status,j);}
 const reader=r.body.getReader(),dec=new TextDecoder();let buf='';
 const take=(line:string)=>{if(!line.trim())return;const x=JSON.parse(line) as {error?:string;cardId:string;area:string;priority:string;estimate:number};if(x.error)throw new ApiError(x.error,502,{error:x.error});onItem(x);};
 for(;;){const {done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;while((i=buf.indexOf('\n'))>=0){take(buf.slice(0,i));buf=buf.slice(i+1);}}take(buf);}
// Backup do quadro: baixa os pedaços até o fim e sobe em pedaços de até 500 cards e uns 3 MB (o limite da Vercel é 4,5 MB por pedido).
export async function collectBoard(){const pieces:BackupPiece[]=[];let after:number|null=0;while(after!==null){const p:BackupPiece=await foco.exportPiece(after);pieces.push(p);after=p.next;}
 return {cards:pieces.flatMap(p=>p.cards),events:pieces.flatMap(p=>p.events),audit:pieces[0]?.audit||[],plans:pieces[0]?.plans||[]};}
const field=(v:unknown,k:string)=>{const x=v&&typeof v==='object'?(v as Record<string,unknown>)[k]:undefined;return typeof x==='string'?x:'';};
export async function pushBoard(board:{cards:unknown[];events?:unknown[];audit?:unknown[];plans?:unknown[]}){const byCard=new Map<string,unknown[]>();for(const e of board.events||[]){const id=field(e,'cardId'),l=byCard.get(id)||[];l.push(e);byCard.set(id,l);}
 const pieces:{cards:unknown[];events:unknown[]}[]=[];let cur={cards:[] as unknown[],events:[] as unknown[]},size=0;
 for(const c of board.cards){const evs=byCard.get(field(c,'id'))||[],s=JSON.stringify(c).length+JSON.stringify(evs).length;if(cur.cards.length&&(cur.cards.length>=500||size+s>3_000_000)){pieces.push(cur);cur={cards:[],events:[]};size=0;}cur.cards.push(c);cur.events.push(...evs);size+=s;}
 if(cur.cards.length||!pieces.length)pieces.push(cur);
 for(const [i,p] of pieces.entries())await foco.importPiece({replace:i===0,cards:p.cards,events:p.events,...(i===0?{audit:board.audit||[],plans:board.plans||[]}:{})});}

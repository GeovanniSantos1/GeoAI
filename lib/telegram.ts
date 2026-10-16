import type { Proposal } from './types.ts';
import { describeProposal } from './agent.ts';

// Peças puras da integração com o Telegram: leitura das atualizações, comandos e formatação.
export type TelegramEvent =
 | {kind:'message';updateId:number;chatId:string;private:boolean;text:string;label:string}
 | {kind:'callback';updateId:number;chatId:string;callbackId:string;messageId:number;data:string};
export type HistoryEntry = {role:'user'|'assistant';text:string};
export type Pending = Record<string,{items:Proposal[];createdAt:string}>;
export const TELEGRAM_LIMIT = 4096;
type RawChat = {id?:unknown;type?:string;first_name?:string;last_name?:string;title?:string;username?:string};
type RawUpdate = {update_id?:unknown;message?:{message_id?:number;chat?:RawChat;text?:unknown};callback_query?:{id?:unknown;data?:unknown;message?:{message_id:number;chat?:RawChat}}};

export function parseUpdate(raw:unknown):TelegramEvent|null{
 const u=raw as RawUpdate|null;if(!u||typeof u!=='object'||typeof u.update_id!=='number'||!Number.isSafeInteger(u.update_id))return null;
 const m=u.message;
 if(m?.chat&&Number.isSafeInteger(m.chat.id)){const c=m.chat,name=[c.first_name,c.last_name].filter(Boolean).join(' ')||c.title||'Telegram';return {kind:'message',updateId:u.update_id,chatId:String(c.id),private:c.type==='private',text:typeof m.text==='string'?m.text.slice(0,4000):'',label:(name+(c.username?' (@'+c.username+')':'')).slice(0,120)};}
 const q=u.callback_query,qm=q?.message;
 if(q&&qm?.chat&&typeof q.id==='string'&&typeof q.data==='string'&&Number.isSafeInteger(qm.chat.id))return {kind:'callback',updateId:u.update_id,chatId:String(qm.chat.id),callbackId:q.id,messageId:qm.message_id,data:q.data.slice(0,64)};
 return null;
}

export function command(text:string){const match=/^\/([a-zA-Z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text.trim());return match?{name:match[1].toLowerCase(),arg:(match[2]||'').trim()}:null;}

// Derivado do token: o Telegram reenvia este valor no cabeçalho X-Telegram-Bot-Api-Secret-Token de cada chamada.
export async function webhookSecret(token:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('geoai-telegram:'+token));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}

export function newCode(){const bytes=crypto.getRandomValues(new Uint8Array(18));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_');}

export function chunkText(text:string,limit=TELEGRAM_LIMIT){
 const parts:string[]=[];let rest=text.trim();
 while(rest){if(rest.length<=limit){parts.push(rest);break;}const cut=rest.lastIndexOf('\n',limit);const at=cut>limit/2?cut:limit;parts.push(rest.slice(0,at).trim());rest=rest.slice(at).trim();}
 return parts;
}

export function proposalList(items:Proposal[]){return items.map(p=>'• '+p.item.title+' — '+describeProposal(p)).join('\n');}

export function pushHistory(history:unknown,entries:HistoryEntry[],max=12):HistoryEntry[]{const valid=(Array.isArray(history)?history:[]).filter((h):h is HistoryEntry=>{const e=h as Partial<HistoryEntry>|null;return (e?.role==='user'||e?.role==='assistant')&&typeof e.text==='string';});return [...valid,...entries].slice(-max);}

export function addPending(pending:Pending,id:string,items:Proposal[],max=5):Pending{const entries=Object.entries(pending&&typeof pending==='object'?pending:{});return Object.fromEntries([...entries,[id,{items,createdAt:new Date().toISOString()}]].slice(-max));}

export function telegramApi(token:string,base='https://api.telegram.org'){
 return async function call<T=unknown>(method:string,body:Record<string,unknown>={}):Promise<T>{
  const response=await fetch(base+'/bot'+token+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const json=await response.json().catch(()=>({})) as {ok?:boolean;description?:string;result?:unknown};
  if(!json.ok)throw new Error(json.description||'Telegram indisponível');
  return json.result as T;
 };
}

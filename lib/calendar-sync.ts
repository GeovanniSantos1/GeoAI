import {fetchEvents,ProviderError,type Fetch} from './calendar-providers.ts';import {hasScope,type ExternalEvent,type FeedStatus,type FeedView,type Provider} from './external-calendar.ts';
// Sincronização do espelho das agendas externas. Banco, Clerk e rede chegam como dependências (ligadas em calendar-server.ts).
export type FeedRow={userId:string;provider:Provider;account:string;events:ExternalEvent[];syncedAt:string|null;status:FeedStatus;error:string|null;connectedAt:string};
export type FeedStore={list:(userId:string)=>Promise<FeedRow[]>;get:(userId:string,provider:Provider)=>Promise<FeedRow|null>;create:(row:FeedRow)=>Promise<void>;update:(row:FeedRow)=>Promise<void>;remove:(userId:string,provider?:Provider)=>Promise<void>;all:()=>Promise<FeedRow[]>};
export type SyncDeps={store:FeedStore;getToken:(userId:string,provider:Provider)=>Promise<{token:string;scopes?:string[]}|null>;account:(userId:string,provider:Provider)=>Promise<string>;fetch:Fetch;now?:()=>Date};
const DAY=86400000;export const MIN_INTERVAL_MS=60*1000;
export const EXTERNAL_FOR_AGENT={maxAgeMs:30*60*1000,budgetMs:5000};
const clock=(d:SyncDeps)=>d.now?.()??new Date();
// Uma sincronização boa troca o espelho inteiro; com erro, o espelho anterior fica e só o estado muda.
export async function syncFeed(d:SyncDeps,row:FeedRow):Promise<FeedRow>{const now=clock(d),syncedAt=now.toISOString();let next:FeedRow;
 try{const t=await d.getToken(row.userId,row.provider);if(!t?.token)throw new ProviderError('reconnect');
  if(!hasScope(row.provider,t.scopes)){console.error('calendar scope',row.provider,'sem a permissão da agenda');throw new ProviderError('reconnect');}
  const events=await fetchEvents(row.provider,d.fetch,t.token,new Date(now.getTime()-30*DAY),new Date(now.getTime()+90*DAY));next={...row,events,status:'ok',error:null,syncedAt};}
 catch(e){const err=e instanceof ProviderError?e:new ProviderError('error');if(!(e instanceof ProviderError))console.error('calendar sync',row.provider,e instanceof Error?e.message:'erro');next={...row,status:err.kind,error:err.message,syncedAt};}
 // Só atualiza: se o usuário desconectou durante a sincronização, a linha continua apagada.
 await d.store.update(next);return next;}
export async function connectFeed(d:SyncDeps,userId:string,provider:Provider,existing:FeedRow|null):Promise<FeedRow>{const account=await d.account(userId,provider).catch(()=>'');
 const row:FeedRow=existing?{...existing,account:account||existing.account}:{userId,provider,account,events:[],syncedAt:null,status:'ok',error:null,connectedAt:clock(d).toISOString()};
 if(!existing)await d.store.create(row);
 const result=await syncFeed(d,row);
 // Autorização negada na primeira conexão: não deixa uma conta "Precisa reconectar" para trás.
 if(!existing&&result.status==='reconnect')await d.store.remove(userId,provider);
 return result;}
// "Conectar" (connect) cria a conta que falta; "Atualizar agora" sem a conta (desconectada ou apagada) não a recria e devolve null.
// Conta que precisa reconectar passa pela conexão; as demais, inclusive com erro, sincronizam no máximo uma vez por minuto.
export async function refreshFeed(d:SyncDeps,userId:string,provider:Provider,connect=false):Promise<FeedRow|null>{const row=await d.store.get(userId,provider);
 if(!row)return connect?connectFeed(d,userId,provider,null):null;
 if(row.status==='reconnect')return connectFeed(d,userId,provider,row);
 if(row.syncedAt&&clock(d).getTime()-Date.parse(row.syncedAt)<MIN_INTERVAL_MS)return row;
 return syncFeed(d,row);}
export async function ensureFresh(d:SyncDeps,userId:string,maxAgeMs:number):Promise<FeedRow[]>{const now=clock(d).getTime();
 return Promise.all((await d.store.list(userId)).map(r=>!r.syncedAt||now-Date.parse(r.syncedAt)>maxAgeMs?syncFeed(d,r):r));}
// Assistente e Telegram não esperam mais que budgetMs; no tempo esgotado ou em erro, usam o espelho atual.
export async function loadExternal(d:SyncDeps,userId:string,o:{maxAgeMs:number;budgetMs:number}):Promise<ExternalEvent[]>{let timer:ReturnType<typeof setTimeout>|undefined;
 const late=new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),o.budgetMs);});
 const rows=await Promise.race([ensureFresh(d,userId,o.maxAgeMs).catch(()=>null),late]);clearTimeout(timer);
 return (rows??await d.store.list(userId).catch(():FeedRow[]=>[])).flatMap(r=>r.events);}
// Cron diário: da conta sincronizada há mais tempo para a mais recente; não começa outra depois do prazo.
export async function syncAll(d:SyncDeps,deadlineMs=45000){const started=Date.now();let synced=0,failed=0,skipped=0;
 const rows=(await d.store.all()).sort((a,b)=>(a.syncedAt||'').localeCompare(b.syncedAt||''));
 for(const row of rows){if(Date.now()-started>=deadlineMs){skipped++;continue;}
  try{if((await syncFeed(d,row)).status==='ok')synced++;else failed++;}catch(e){failed++;console.error('calendar cron',e instanceof Error?e.message:'erro');}}
 return {total:rows.length,synced,failed,skipped};}
export const toView=(r:FeedRow):FeedView=>({provider:r.provider,account:r.account,status:r.status,...(r.error?{error:r.error}:{}),...(r.syncedAt?{syncedAt:r.syncedAt}:{})});
export const calendarPayload=(rows:FeedRow[])=>({feeds:rows.map(toView),events:rows.flatMap(r=>r.events)});

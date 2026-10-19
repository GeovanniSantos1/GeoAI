import {addDays,scheduledItems,validDate} from './core.ts';import type {Item,Workspace} from './types.ts';
// Agendas externas (Outlook e Google) entram na agenda como espelho só leitura: nada é salvo no workspace.
export type Provider='microsoft'|'google';
export const PROVIDERS:Provider[]=['microsoft','google'];
export const PROVIDER_LABEL:Record<Provider,string>={microsoft:'Outlook',google:'Google'};
// Escopos pedidos ao conectar. A sincronização aceita também escopos mais amplos que a pessoa já tenha concedido.
export const OAUTH_SCOPES:Record<Provider,string[]>={google:['https://www.googleapis.com/auth/calendar.events.readonly'],microsoft:['Calendars.Read','offline_access']};
const ACCEPTED:Record<Provider,string[]>={google:['https://www.googleapis.com/auth/calendar.events.readonly','https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/calendar.events','https://www.googleapis.com/auth/calendar'],microsoft:['calendars.read','calendars.readwrite']};
// Sem a lista de escopos (o Clerk nem sempre informa), a sincronização tenta e a API decide.
export function hasScope(provider:Provider,scopes?:string[]){if(!scopes)return true;return scopes.some(s=>ACCEPTED[provider].includes(s.toLowerCase().replace(/^https:\/\/graph\.microsoft\.com\//,'')));}
export type ExternalEvent={id:string;provider:Provider;title:string;allDay:boolean;start:string;end:string;location?:string;joinUrl?:string;webLink?:string};
export type FeedStatus='ok'|'reconnect'|'error';
export type FeedView={provider:Provider;account:string;status:FeedStatus;error?:string;syncedAt?:string};
type GraphTime={dateTime?:string;timeZone?:string};
export type GraphRaw={id?:unknown;subject?:unknown;start?:GraphTime;end?:GraphTime;isAllDay?:boolean;isCancelled?:boolean;location?:{displayName?:unknown};onlineMeeting?:{joinUrl?:unknown}|null;webLink?:unknown;responseStatus?:{response?:string}};
type GoogleTime={date?:string;dateTime?:string};
export type GoogleRaw={id?:unknown;status?:string;summary?:unknown;start?:GoogleTime;end?:GoogleTime;location?:unknown;hangoutLink?:unknown;htmlLink?:unknown;conferenceData?:{entryPoints?:{entryPointType?:string;uri?:unknown}[]};attendees?:{self?:boolean;responseStatus?:string}[]};
const DAY=86400000;export const FRESH_MS=10*60*1000;
const text=(value:unknown,max:number)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
function https(value:unknown){if(typeof value!=='string'||value.length>2000)return undefined;try{return new URL(value).protocol==='https:'?value:undefined;}catch{return undefined;}}
const utc=(d:Date)=>d.toISOString().slice(0,19)+'Z';
function build(provider:Provider,id:string,title:unknown,allDay:boolean,range:{start:string;end:string},extra:{location?:unknown;joinUrl?:unknown;webLink?:unknown}):ExternalEvent{
 const location=text(extra.location,200),joinUrl=https(extra.joinUrl),webLink=https(extra.webLink);
 return {id:id.slice(0,200),provider,title:text(title,180)||'(Sem título)',allDay,...range,...(location?{location}:{}),...(joinUrl?{joinUrl}:{}),...(webLink?{webLink}:{})};}
// Dia inteiro tem fim exclusivo; fim ausente ou não posterior ao início vira um dia só.
function dayRange(start:unknown,end:unknown){const s=typeof start==='string'?start.slice(0,10):'';if(!validDate(s))return null;const e=typeof end==='string'?end.slice(0,10):'';return {start:s,end:validDate(e)&&e>s?e:addDays(s,1)};}
// Com horário: fim ausente ou anterior ao início vira duração zero.
function timeRange(start:Date,end:Date|null){if(!Number.isFinite(start.getTime()))return null;return {start:utc(start),end:utc(end&&Number.isFinite(end.getTime())&&end>start?end:start)};}
// O Graph é chamado com Prefer: outlook.timezone="UTC" e devolve datas sem "Z", com sete casas de fração.
const graphDate=(v?:GraphTime)=>typeof v?.dateTime==='string'?new Date(v.dateTime.replace(/\.\d+$/,'')+'Z'):new Date(NaN);
export function normalizeGraphEvent(raw:GraphRaw|null|undefined):ExternalEvent|null{
 if(!raw||typeof raw.id!=='string'||!raw.id||raw.isCancelled||raw.responseStatus?.response==='declined')return null;
 const extra={location:raw.location?.displayName,joinUrl:raw.onlineMeeting?.joinUrl,webLink:raw.webLink};
 const range=raw.isAllDay?dayRange(raw.start?.dateTime,raw.end?.dateTime):timeRange(graphDate(raw.start),raw.end?graphDate(raw.end):null);
 return range?build('microsoft',raw.id,raw.subject,!!raw.isAllDay,range,extra):null;}
export function normalizeGoogleEvent(raw:GoogleRaw|null|undefined):ExternalEvent|null{
 if(!raw||typeof raw.id!=='string'||!raw.id||raw.status==='cancelled')return null;
 if(Array.isArray(raw.attendees)&&raw.attendees.some(x=>x?.self&&x.responseStatus==='declined'))return null;
 const video=Array.isArray(raw.conferenceData?.entryPoints)?raw.conferenceData.entryPoints.find(x=>x?.entryPointType==='video')?.uri:undefined;
 const extra={location:raw.location,joinUrl:https(raw.hangoutLink)??video,webLink:raw.htmlLink},allDay=!!raw.start?.date;
 const range=allDay?dayRange(raw.start?.date,raw.end?.date):timeRange(new Date(raw.start?.dateTime??NaN),raw.end?.dateTime?new Date(raw.end.dateTime):null);
 return range?build('google',raw.id,raw.summary,allDay,range,extra):null;}
function local(iso:string,zone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso));const get=(t:string)=>parts.find(p=>p.type===t)?.value;return {date:get('year')+'-'+get('month')+'-'+get('day'),time:get('hour')+':'+get('minute')};}
// Itens de um dia no fuso do perfil. Com horário: só no dia de início; eventos de 24 horas ou mais continuam nos dias seguintes
// (terminar à 00:00 não ocupa o dia). Dia inteiro: do início até a véspera do fim.
export function externalOn(events:ExternalEvent[],date:string,zone:string):Item[]{const items:Item[]=[];
 for(const e of events){const base={id:e.provider+':'+e.id,title:e.title,type:'event',provider:e.provider,_collection:'external',...(e.location?{location:e.location}:{}),...(e.joinUrl?{joinUrl:e.joinUrl}:{}),...(e.webLink?{webLink:e.webLink}:{})};
  if(e.allDay){if(e.start<=date&&date<e.end)items.push({...base,allDay:true});continue;}
  const start=local(e.start,zone),end=local(e.end,zone),long=Date.parse(e.end)-Date.parse(e.start)>=DAY;
  if(start.date===date){items.push({...base,time:start.time,...(!long&&e.end>e.start?{endTime:end.time}:{})});continue;}
  const last=end.time==='00:00'?addDays(end.date,-1):end.date;
  if(long&&start.date<date&&date<=last)items.push({...base,allDay:true,continued:true});}
 return items;}
export const agendaItems=(s:Workspace,events:ExternalEvent[],date:string):Item[]=>[...scheduledItems(s,date),...externalOn(events,date,s.profile.timezone)];
// Dia inteiro primeiro, depois por horário; sem horário por último.
export const agendaOrder=(x:Item,y:Item)=>(x.allDay?'':x.time||'99').localeCompare(y.allDay?'':y.time||'99');
export const externalWhen=(t:Item)=>t.allDay?(t.continued?'Continua':'Dia inteiro'):t.time+(t.endTime?'–'+t.endTime:'');
export const isStale=(feeds:{syncedAt?:string|null}[],now:number,maxAgeMs:number)=>feeds.some(f=>!f.syncedAt||now-Date.parse(f.syncedAt)>maxAgeMs);
export function timeAgo(iso:string,now:number){const min=Math.floor((now-Date.parse(iso))/60000);if(min<1)return 'agora';if(min<60)return 'há '+min+' min';const h=Math.floor(min/60);if(h<24)return 'há '+h+' h';const d=Math.floor(h/24);return 'há '+d+(d===1?' dia':' dias');}

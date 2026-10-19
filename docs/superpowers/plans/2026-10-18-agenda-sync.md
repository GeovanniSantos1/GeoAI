# Agenda sincronizada com Outlook/Teams e Google — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar na Agenda e no painel inicial, só para leitura, os compromissos do Outlook (inclusive reuniões do Teams) e do Google Agenda do usuário, sincronizados sozinhos.

**Architecture:** O Clerk faz o OAuth e guarda e renova os tokens; o servidor pede o token ao Clerk, lê o Microsoft Graph ou a Google Calendar API e grava um espelho (JSON) por usuário e provedor na tabela `calendar_feeds`. O app soma o espelho às ações na hora de mostrar (`agendaItems`), sem gravar nada no workspace. A lógica fica em três módulos puros testáveis (`external-calendar`, `calendar-providers`, `calendar-sync`) e um módulo de ligação com banco e Clerk (`calendar-server`).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle + Postgres (Neon), Clerk (`@clerk/nextjs` 7), testes com `node --experimental-strip-types --test`.

**Spec:** `docs/superpowers/specs/2026-10-18-agenda-sync-design.md`

## Global Constraints

- Texto de interface e mensagens em português do Brasil; código no estilo compacto dos arquivos vizinhos (`lib/trt-reminders.ts`, `lib/telegram-store.ts`).
- Só leitura: nenhuma chamada cria, altera ou apaga eventos no Outlook ou no Google.
- Escopos: Google `https://www.googleapis.com/auth/calendar.events.readonly`; Microsoft `Calendars.Read` e `offline_access`.
- Janela de sincronização: 30 dias antes até 90 dias depois do momento da sincronização. Até 1000 eventos por provedor.
- Atualização: ao abrir o app quando o espelho tem mais de 10 minutos; "Atualizar agora" no máximo uma vez por minuto; assistente e Telegram com 30 minutos e no máximo 5 s de espera; cron diário `0 9 * * *`.
- Cada chamada aos provedores com tempo máximo de 10 s. O token só é enviado a `https://graph.microsoft.com/` e `https://www.googleapis.com/`.
- Links externos só `https:`, abertos com `target="_blank" rel="noreferrer"`.
- Módulos importados pelos testes (`lib/external-calendar.ts`, `lib/calendar-providers.ts`, `lib/calendar-sync.ts`) importam outros módulos de `lib/` com a extensão `.ts` e não usam `@/`, enums nem propriedades de parâmetro em construtores (o `--experimental-strip-types` não as aceita).
- Arquivos novos sem erros de ESLint (`npx eslint <arquivo>`); arquivos alterados sem aumentar os erros da linha de base: `settings.tsx` 5, `planning.tsx` 2, `NorteApp.tsx` 13, `context.tsx` 2, os demais 0. (`npm run lint` no repositório inteiro inclui pastas geradas e não serve de critério.)
- Linha de base em `feat/agenda-sync` depois de `npm ci`: `npm test` 80 testes passando, `npm run typecheck` e `npm run build` sem erros.

**Ajustes ao spec feitos neste plano:**
- Em `error`, a linha diz "Não foi possível atualizar agora. Os compromissos mostrados podem estar desatualizados." sem "última atualização há X", porque `synced_at` registra a última tentativa (é ela que evita repetir tentativas a cada abertura).
- O contexto ganha `calendar.refresh(provider?)` e `calendar.disconnect(provider)`. Conectar é feito pelo cartão de Configurações (Clerk) e termina em `refresh(provider)`, que no servidor conecta ou sincroniza.

## Review Focus

- Um `@odata.nextLink` apontando para outro endereço que não o Graph: a leitura para ali, sem enviar o token (teste na Tarefa 2).
- O usuário desconecta enquanto uma sincronização está em andamento: a conta continua desconectada, sem reaparecer (teste na Tarefa 3).
- Evento sem fim ou com fim antes do início (dos dois provedores): o evento com horário vira duração zero no início; o de dia inteiro vira um dia (teste na Tarefa 1).
- Perfil num fuso com horário de verão (`Europe/Lisbon`, que muda em 25/10/2026): o horário local fica certo dos dois lados da mudança (teste na Tarefa 1).
- O Clerk devolve o token sem a lista `scopes`: a sincronização tenta a API e, se ela responder 401, marca "Precisa reconectar" (teste na Tarefa 3).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/external-calendar.ts` (novo) | Tipos, escopos, normalização dos eventos do Graph e do Google, eventos de um dia no fuso do perfil, junção com a agenda, textos de horário e "há X". Puro; usado no servidor e no navegador. |
| `lib/calendar-providers.ts` (novo) | Leitura paginada do Microsoft Graph e da Google Calendar API com `fetch` injetado; `ProviderError`. |
| `lib/calendar-sync.ts` (novo) | Sincronização com dependências injetadas: `syncFeed`, `connectFeed`, `refreshFeed`, `ensureFresh`, `loadExternal`, `syncAll`, `calendarPayload`. |
| `lib/calendar-server.ts` (novo) | `feedStore` (Drizzle), token e e-mail pelo Clerk, `calendarDeps()`. |
| `db/schema.ts`, `drizzle/0002_*.sql` | Tabela `calendar_feeds`. |
| `app/api/calendar/route.ts` (novo) | `GET`, `POST`, `DELETE` do espelho para o app. |
| `app/api/cron/calendar-sync/route.ts` (novo), `vercel.json` | Sincronização diária. |
| `app/api/state/route.ts` | "Apagar meus dados" também apaga as conexões. |
| `lib/agent.ts`, `lib/agent-runtime.ts`, `app/api/assistant/route.ts`, `app/api/telegram/route.ts` | Assistente e bot enxergam os externos, só leitura. |
| `components/norte/context.tsx`, `components/norte/NorteApp.tsx` | Estado `calendar` no contexto; carga e sincronização em segundo plano. |
| `components/norte/planning.tsx`, `app/globals.css` | Linhas externas, resumo do evento, Agenda e painel inicial. |
| `components/norte/settings.tsx` | Cartão "Outlook / Teams" e "Google Agenda". |
| `docs/agenda-integracao.md` (novo), `README.md` | Passo a passo da configuração e limites. |
| `tests/external-calendar.test.mjs`, `tests/calendar-providers.test.mjs`, `tests/calendar-sync.test.mjs` (novos), `tests/agent.test.mjs`, `package.json` | Testes. |

---

### Task 1: Modelo de evento externo (lógica pura)

**Files:**
- Create: `lib/external-calendar.ts`
- Create: `tests/external-calendar.test.mjs`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: `addDays`, `scheduledItems`, `validDate` de `lib/core.ts`; `Item`, `Workspace` de `lib/types.ts`.
- Produces (usado pelas Tarefas 2 a 8):
  - `type Provider='microsoft'|'google'`; `PROVIDERS:Provider[]`; `PROVIDER_LABEL:Record<Provider,string>` (`Outlook`, `Google`).
  - `OAUTH_SCOPES:Record<Provider,string[]>`; `hasScope(provider:Provider,scopes?:string[]):boolean`.
  - `type ExternalEvent={id;provider;title;allDay;start;end;location?;joinUrl?;webLink?}`; `type FeedStatus='ok'|'reconnect'|'error'`; `type FeedView={provider;account;status;error?;syncedAt?}`.
  - `normalizeGraphEvent(raw:GraphRaw|null|undefined):ExternalEvent|null`; `normalizeGoogleEvent(raw:GoogleRaw|null|undefined):ExternalEvent|null`; tipos `GraphRaw` e `GoogleRaw` exportados.
  - `externalOn(events:ExternalEvent[],date:string,zone:string):Item[]` — itens com `_collection:'external'`, `id` = `provider+':'+id`, `provider`, `type:'event'`, e `time`/`endTime` ou `allDay` (+ `continued`).
  - `agendaItems(s:Workspace,events:ExternalEvent[],date:string):Item[]`; `agendaOrder(x:Item,y:Item):number`; `externalWhen(t:Item):string`.
  - `FRESH_MS=600000`; `isStale(feeds:{syncedAt?:string|null}[],now:number,maxAgeMs:number):boolean`; `timeAgo(iso:string,now:number):string`.

- [ ] **Step 0: Preparar o ambiente**

Run: `npm ci` e depois `npm test`
Expected: `ℹ tests 80`, `ℹ pass 80`, `ℹ fail 0`.

- [ ] **Step 1: Escrever os testes**

Criar `tests/external-calendar.test.mjs`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../lib/core.ts';
import {normalizeGraphEvent,normalizeGoogleEvent,externalOn,agendaItems,agendaOrder,externalWhen,hasScope,isStale,timeAgo} from '../lib/external-calendar.ts';

const teams={id:'AAMk1',subject:'Daily do projeto',start:{dateTime:'2026-10-20T12:00:00.0000000',timeZone:'UTC'},end:{dateTime:'2026-10-20T12:30:00.0000000',timeZone:'UTC'},isAllDay:false,isCancelled:false,location:{displayName:'Microsoft Teams Meeting'},onlineMeeting:{joinUrl:'https://teams.microsoft.com/l/meetup-join/abc'},webLink:'https://outlook.office365.com/owa/?itemid=AAMk1',responseStatus:{response:'accepted'}};
const meet={id:'g1',status:'confirmed',summary:'Dentista',start:{dateTime:'2026-10-20T14:00:00-03:00'},end:{dateTime:'2026-10-20T15:00:00-03:00'},location:'Rua A, 10',hangoutLink:'https://meet.google.com/abc-defg-hij',htmlLink:'https://www.google.com/calendar/event?eid=g1'};
const ev=extra=>({id:'e',provider:'microsoft',title:'Evento',allDay:false,start:'2026-10-20T12:00:00Z',end:'2026-10-20T13:00:00Z',...extra});
const SP='America/Sao_Paulo',NOW=Date.parse('2026-10-18T12:00:00Z');

test('Graph: reunião do Teams vira evento em UTC com link e local',()=>{
 assert.deepEqual(normalizeGraphEvent(teams),{id:'AAMk1',provider:'microsoft',title:'Daily do projeto',allDay:false,start:'2026-10-20T12:00:00Z',end:'2026-10-20T12:30:00Z',location:'Microsoft Teams Meeting',joinUrl:'https://teams.microsoft.com/l/meetup-join/abc',webLink:'https://outlook.office365.com/owa/?itemid=AAMk1'});});
test('Graph: dia inteiro, cancelado, recusado, sem título e link sem https',()=>{
 const day=normalizeGraphEvent({...teams,id:'d',isAllDay:true,start:{dateTime:'2026-10-21T00:00:00.0000000'},end:{dateTime:'2026-10-22T00:00:00.0000000'},onlineMeeting:null});
 assert.equal(day.allDay,true);assert.equal(day.start,'2026-10-21');assert.equal(day.end,'2026-10-22');assert.equal('joinUrl' in day,false);
 assert.equal(normalizeGraphEvent({...teams,isCancelled:true}),null);
 assert.equal(normalizeGraphEvent({...teams,responseStatus:{response:'declined'}}),null);
 assert.equal(normalizeGraphEvent({...teams,id:undefined}),null);
 const bare=normalizeGraphEvent({...teams,subject:'  ',webLink:'http://outlook.example.com/x',location:{displayName:''}});
 assert.equal(bare.title,'(Sem título)');assert.equal('webLink' in bare,false);assert.equal('location' in bare,false);
 const long=normalizeGraphEvent({...teams,subject:'Linha 1\nLinha 2 '+'x'.repeat(300)});assert.equal(long.title.length,180);assert.ok(long.title.startsWith('Linha 1 Linha 2 x'));});
test('evento sem fim ou com fim antes do início não quebra',()=>{
 assert.equal(normalizeGraphEvent({...teams,end:undefined}).end,'2026-10-20T12:00:00Z');
 assert.equal(normalizeGraphEvent({...teams,end:{dateTime:'2026-10-20T11:00:00.0000000'}}).end,'2026-10-20T12:00:00Z');
 assert.equal(normalizeGoogleEvent({id:'g',summary:'X',start:{date:'2026-10-23'},end:{date:'2026-10-23'}}).end,'2026-10-24');
 assert.equal(normalizeGoogleEvent({id:'g',summary:'X',start:{date:'2026-10-23'}}).end,'2026-10-24');});
test('Google: Meet, Zoom pela conferência, dia inteiro, cancelado e recusado',()=>{
 assert.deepEqual(normalizeGoogleEvent(meet),{id:'g1',provider:'google',title:'Dentista',allDay:false,start:'2026-10-20T17:00:00Z',end:'2026-10-20T18:00:00Z',location:'Rua A, 10',joinUrl:'https://meet.google.com/abc-defg-hij',webLink:'https://www.google.com/calendar/event?eid=g1'});
 assert.equal(normalizeGoogleEvent({...meet,hangoutLink:undefined,conferenceData:{entryPoints:[{entryPointType:'phone',uri:'tel:+5511'},{entryPointType:'video',uri:'https://zoom.us/j/1'}]}}).joinUrl,'https://zoom.us/j/1');
 const trip=normalizeGoogleEvent({id:'g2',summary:'Viagem',start:{date:'2026-10-23'},end:{date:'2026-10-26'}});assert.deepEqual([trip.allDay,trip.start,trip.end],[true,'2026-10-23','2026-10-26']);
 assert.equal(normalizeGoogleEvent({...meet,status:'cancelled'}),null);
 assert.equal(normalizeGoogleEvent({...meet,attendees:[{email:'a@x.com',responseStatus:'accepted'},{self:true,responseStatus:'declined'}]}),null);
 assert.notEqual(normalizeGoogleEvent({...meet,attendees:[{email:'a@x.com',responseStatus:'declined'},{self:true,responseStatus:'accepted'}]}),null);});
test('externalOn usa o fuso do perfil, cruza a meia-noite e continua eventos longos',()=>{
 assert.deepEqual(externalOn([ev({start:'2026-10-21T01:00:00Z',end:'2026-10-21T02:00:00Z'})],'2026-10-20',SP),[{id:'microsoft:e',title:'Evento',type:'event',provider:'microsoft',_collection:'external',time:'22:00',endTime:'23:00'}]);
 assert.deepEqual(externalOn([ev({start:'2026-10-21T01:00:00Z',end:'2026-10-21T02:00:00Z'})],'2026-10-21',SP),[]);
 const night=ev({start:'2026-10-21T02:00:00Z',end:'2026-10-21T03:30:00Z'});
 assert.deepEqual(externalOn([night],'2026-10-20',SP).map(x=>[x.time,x.endTime]),[['23:00','00:30']]);assert.deepEqual(externalOn([night],'2026-10-21',SP),[]);
 const long=ev({start:'2026-10-20T12:00:00Z',end:'2026-10-22T12:00:00Z'});
 const first=externalOn([long],'2026-10-20',SP)[0];assert.equal(first.time,'09:00');assert.equal('endTime' in first,false);
 for(const d of ['2026-10-21','2026-10-22'])assert.deepEqual(externalOn([long],d,SP).map(x=>[x.allDay,x.continued,x.time]),[[true,true,undefined]]);
 assert.deepEqual(externalOn([long],'2026-10-23',SP),[]);
 const fullDay=ev({start:'2026-10-20T03:00:00Z',end:'2026-10-21T03:00:00Z'});assert.equal(externalOn([fullDay],'2026-10-20',SP)[0].time,'00:00');assert.deepEqual(externalOn([fullDay],'2026-10-21',SP),[]);
 const trip=ev({allDay:true,start:'2026-10-23',end:'2026-10-26'});
 assert.deepEqual(['2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26'].map(d=>externalOn([trip],d,SP).length),[0,1,1,1,0]);
 const linked=externalOn([ev({joinUrl:'https://teams.microsoft.com/x',location:'Sala 3'})],'2026-10-20',SP)[0];assert.equal(linked.joinUrl,'https://teams.microsoft.com/x');assert.equal(linked.location,'Sala 3');});
test('externalOn acompanha o horário de verão de Lisboa',()=>{
 assert.deepEqual(externalOn([ev({start:'2026-10-24T09:00:00Z',end:'2026-10-24T10:00:00Z'})],'2026-10-24','Europe/Lisbon').map(x=>[x.time,x.endTime]),[['10:00','11:00']]);
 assert.deepEqual(externalOn([ev({start:'2026-10-26T09:00:00Z',end:'2026-10-26T10:00:00Z'})],'2026-10-26','Europe/Lisbon').map(x=>[x.time,x.endTime]),[['09:00','10:00']]);
 assert.equal(externalOn([ev({start:'2026-10-24T09:00:00Z',end:'2026-10-24T10:00:00Z'})],'2026-10-24',SP)[0].time,'06:00');});
test('agendaItems junta ações e externos; dia inteiro primeiro e sem horário por último',()=>{
 const s=emptyWorkspace('Geo');s.tasks=[{id:'t1',title:'Revisar proposta',date:'2026-10-20',time:'10:30',type:'task'},{id:'t2',title:'Ler',date:'2026-10-20',type:'task'}];
 const items=agendaItems(s,[ev({id:'m',title:'Daily',start:'2026-10-20T12:00:00Z',end:'2026-10-20T12:30:00Z'}),ev({id:'f',provider:'google',title:'Feriado',allDay:true,start:'2026-10-20',end:'2026-10-21'})],'2026-10-20').sort(agendaOrder);
 assert.deepEqual(items.map(x=>x.title),['Feriado','Daily','Revisar proposta','Ler']);assert.deepEqual(items.map(x=>x._collection),['external','external','tasks','tasks']);});
test('textos de horário, escopos, espelho vencido e "há X"',()=>{
 assert.equal(externalWhen({id:'a',title:'a',time:'09:00',endTime:'09:30'}),'09:00–09:30');assert.equal(externalWhen({id:'a',title:'a',time:'09:00'}),'09:00');
 assert.equal(externalWhen({id:'a',title:'a',allDay:true}),'Dia inteiro');assert.equal(externalWhen({id:'a',title:'a',allDay:true,continued:true}),'Continua');
 assert.equal(hasScope('google',['openid','https://www.googleapis.com/auth/calendar.events.readonly']),true);assert.equal(hasScope('google',['openid']),false);
 assert.equal(hasScope('google',['https://www.googleapis.com/auth/calendar']),true);assert.equal(hasScope('microsoft',['https://graph.microsoft.com/Calendars.Read']),true);
 assert.equal(hasScope('microsoft',['calendars.read']),true);assert.equal(hasScope('microsoft',['User.Read']),false);assert.equal(hasScope('microsoft',undefined),true);
 assert.equal(isStale([{syncedAt:null}],NOW,600000),true);assert.equal(isStale([{syncedAt:'2026-10-18T11:55:00Z'}],NOW,600000),false);
 assert.equal(isStale([{syncedAt:'2026-10-18T11:49:00Z'}],NOW,600000),true);assert.equal(isStale([],NOW,600000),false);
 assert.deepEqual(['2026-10-18T11:59:30Z','2026-10-18T11:55:00Z','2026-10-18T10:00:00Z','2026-10-17T12:00:00Z','2026-10-15T12:00:00Z'].map(x=>timeAgo(x,NOW)),['agora','há 5 min','há 2 h','há 1 dia','há 3 dias']);});
```

- [ ] **Step 2: Incluir o arquivo no script de testes e ver falhar**

Em `package.json`, no script `test`, acrescentar ` tests/external-calendar.test.mjs` depois de `tests/trt-reminders.test.mjs`.

Run: `node --experimental-strip-types --test tests/external-calendar.test.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `lib/external-calendar.ts`.

- [ ] **Step 3: Implementar**

Criar `lib/external-calendar.ts`:

```ts
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
```

- [ ] **Step 4: Rodar os testes**

Run: `node --experimental-strip-types --test tests/external-calendar.test.mjs`
Expected: PASS, 8 testes.

Run: `npm test`
Expected: `ℹ pass 88`, `ℹ fail 0`.

Run: `npx eslint lib/external-calendar.ts`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/external-calendar.ts tests/external-calendar.test.mjs package.json
git commit -m "Modelo dos compromissos do Outlook e do Google na agenda"
```

---

### Task 2: Leitura do Microsoft Graph e da Google Calendar API

**Files:**
- Create: `lib/calendar-providers.ts`
- Create: `tests/calendar-providers.test.mjs`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: `normalizeGraphEvent`, `normalizeGoogleEvent`, `ExternalEvent`, `Provider`, `GraphRaw`, `GoogleRaw` (Tarefa 1).
- Produces (usado pela Tarefa 3):
  - `type Fetch=(url:string,init:RequestInit)=>Promise<Response>`.
  - `class ProviderError extends Error` com `kind:'reconnect'|'error'`; mensagem `'Precisa reconectar.'` ou `'Não foi possível atualizar agora.'`.
  - `MAX_EVENTS=1000`.
  - `fetchMicrosoft(fetcher:Fetch,token:string,from:Date,to:Date):Promise<ExternalEvent[]>`; `fetchGoogle(...)` com a mesma assinatura; `fetchEvents(provider:Provider,fetcher:Fetch,token:string,from:Date,to:Date)`.

- [ ] **Step 1: Escrever os testes**

Criar `tests/calendar-providers.test.mjs`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchMicrosoft,fetchGoogle,ProviderError,MAX_EVENTS} from '../lib/calendar-providers.ts';

const FROM=new Date('2026-09-18T12:00:00Z'),TO=new Date('2027-01-16T12:00:00Z');
// Cada item de `pages` é uma resposta: objeto (JSON 200), número (status HTTP) ou Error (falha de rede).
function fakeFetch(pages){const calls=[];const fn=async(url,init)=>{calls.push({url,headers:init.headers});const next=pages.shift();if(next===undefined)throw new Error('sem mais páginas');if(next instanceof Error)throw next;if(typeof next==='number')return new Response('{}',{status:next});return Response.json(next);};fn.calls=calls;return fn;}
const graph=(id,extra={})=>({id,subject:'Reunião '+id,start:{dateTime:'2026-10-20T12:00:00.0000000'},end:{dateTime:'2026-10-20T12:30:00.0000000'},...extra});
const google=(id,extra={})=>({id,summary:'Evento '+id,start:{dateTime:'2026-10-20T09:00:00-03:00'},end:{dateTime:'2026-10-20T10:00:00-03:00'},...extra});

test('Graph: janela em UTC, cabeçalhos, paginação pelo nextLink e cancelados fora',async()=>{
 const f=fakeFetch([{value:[graph('a'),graph('b',{isCancelled:true})],'@odata.nextLink':'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=2'},{value:[graph('c')]}]);
 const events=await fetchMicrosoft(f,'tok',FROM,TO);
 assert.deepEqual(events.map(e=>e.id),['a','c']);assert.equal(f.calls.length,2);
 assert.equal(f.calls[0].headers.Authorization,'Bearer tok');assert.equal(f.calls[0].headers.Prefer,'outlook.timezone="UTC"');
 assert.ok(f.calls[0].url.startsWith('https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=2026-09-18T12%3A00%3A00.000Z&endDateTime=2027-01-16T12%3A00%3A00.000Z&$select='));
 assert.equal(f.calls[1].url,'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=2');});
test('Graph: nextLink de outro endereço encerra a leitura sem enviar o token',async()=>{
 const f=fakeFetch([{value:[graph('a')],'@odata.nextLink':'https://evil.example.com/steal'}]);
 assert.deepEqual((await fetchMicrosoft(f,'tok',FROM,TO)).map(e=>e.id),['a']);assert.equal(f.calls.length,1);});
test('Google: agenda principal, ocorrências expandidas e paginação pelo pageToken',async()=>{
 const f=fakeFetch([{items:[google('a'),google('b',{status:'cancelled'})],nextPageToken:'p2'},{items:[google('c')]}]);
 const events=await fetchGoogle(f,'tok',FROM,TO);assert.deepEqual(events.map(e=>e.id),['a','c']);
 const first=new URL(f.calls[0].url);assert.equal(first.origin+first.pathname,'https://www.googleapis.com/calendar/v3/calendars/primary/events');
 assert.equal(first.searchParams.get('singleEvents'),'true');assert.equal(first.searchParams.get('timeMin'),'2026-09-18T12:00:00.000Z');assert.equal(first.searchParams.get('timeMax'),'2027-01-16T12:00:00.000Z');
 assert.equal(first.searchParams.get('pageToken'),null);assert.equal(new URL(f.calls[1].url).searchParams.get('pageToken'),'p2');assert.equal(f.calls[0].headers.Authorization,'Bearer tok');});
test('401 e 403 pedem para reconectar; 429, 5xx e rede são erro temporário',async()=>{
 for(const [status,kind] of [[401,'reconnect'],[403,'reconnect'],[429,'error'],[500,'error']])await assert.rejects(fetchGoogle(fakeFetch([status]),'tok',FROM,TO),e=>e instanceof ProviderError&&e.kind===kind);
 await assert.rejects(fetchMicrosoft(fakeFetch([new Error('rede')]),'tok',FROM,TO),e=>e instanceof ProviderError&&e.kind==='error'&&e.message==='Não foi possível atualizar agora.');
 await assert.rejects(fetchMicrosoft(fakeFetch([401]),'tok',FROM,TO),e=>e.message==='Precisa reconectar.');});
test('para em 1000 eventos',async()=>{
 const many=n=>Array.from({length:n},(_,i)=>google('e'+n+'-'+i));
 const f=fakeFetch([{items:many(600),nextPageToken:'p2'},{items:many(700),nextPageToken:'p3'},{items:many(10)}]);
 const events=await fetchGoogle(f,'tok',FROM,TO);assert.equal(events.length,MAX_EVENTS);assert.equal(f.calls.length,2);});
```

- [ ] **Step 2: Incluir no script e ver falhar**

Em `package.json`, acrescentar ` tests/calendar-providers.test.mjs` ao fim do script `test`.

Run: `node --experimental-strip-types --test tests/calendar-providers.test.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `lib/calendar-providers.ts`.

- [ ] **Step 3: Implementar**

Criar `lib/calendar-providers.ts`:

```ts
import {normalizeGraphEvent,normalizeGoogleEvent,type ExternalEvent,type GoogleRaw,type GraphRaw,type Provider} from './external-calendar.ts';
// Leitura das agendas pelo Microsoft Graph e pela Google Calendar API. O fetch chega injetado para os testes.
export type Fetch=(url:string,init:RequestInit)=>Promise<Response>;
export const MAX_EVENTS=1000;const MAX_PAGES=10;
export class ProviderError extends Error{kind:'reconnect'|'error';constructor(kind:'reconnect'|'error'){super(kind==='reconnect'?'Precisa reconectar.':'Não foi possível atualizar agora.');this.kind=kind;}}
async function page(fetcher:Fetch,url:string,headers:Record<string,string>):Promise<Record<string,unknown>>{let r:Response;
 try{r=await fetcher(url,{headers,signal:AbortSignal.timeout(10000)});}catch{throw new ProviderError('error');}
 if(r.status===401||r.status===403)throw new ProviderError('reconnect');if(!r.ok)throw new ProviderError('error');
 try{const body=await r.json();return body&&typeof body==='object'?body:{};}catch{throw new ProviderError('error');}}
const GRAPH='https://graph.microsoft.com/';
export async function fetchMicrosoft(fetcher:Fetch,token:string,from:Date,to:Date):Promise<ExternalEvent[]>{const out:ExternalEvent[]=[],headers={Authorization:'Bearer '+token,Prefer:'outlook.timezone="UTC"'};
 let url:string|undefined=GRAPH+'v1.0/me/calendarView?startDateTime='+encodeURIComponent(from.toISOString())+'&endDateTime='+encodeURIComponent(to.toISOString())+'&$select=id,subject,start,end,isAllDay,isCancelled,location,onlineMeeting,webLink,responseStatus&$orderby=start/dateTime&$top=200';
 for(let n=0;url&&n<MAX_PAGES&&out.length<MAX_EVENTS;n++){const body=await page(fetcher,url,headers);
  for(const raw of Array.isArray(body.value)?body.value as GraphRaw[]:[]){const e=normalizeGraphEvent(raw);if(e)out.push(e);}
  // O token só vai para o próprio Graph: um nextLink de outro endereço encerra a leitura.
  const next=body['@odata.nextLink'];url=typeof next==='string'&&next.startsWith(GRAPH)?next:undefined;}
 return out.slice(0,MAX_EVENTS);}
export async function fetchGoogle(fetcher:Fetch,token:string,from:Date,to:Date):Promise<ExternalEvent[]>{const out:ExternalEvent[]=[];let pageToken:string|undefined;
 for(let n=0;n<MAX_PAGES&&out.length<MAX_EVENTS;n++){
  const params=new URLSearchParams({timeMin:from.toISOString(),timeMax:to.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'250',fields:'items(id,status,summary,start,end,location,hangoutLink,conferenceData/entryPoints,htmlLink,attendees(self,responseStatus)),nextPageToken'});if(pageToken)params.set('pageToken',pageToken);
  const body=await page(fetcher,'https://www.googleapis.com/calendar/v3/calendars/primary/events?'+params,{Authorization:'Bearer '+token});
  for(const raw of Array.isArray(body.items)?body.items as GoogleRaw[]:[]){const e=normalizeGoogleEvent(raw);if(e)out.push(e);}
  pageToken=typeof body.nextPageToken==='string'?body.nextPageToken:undefined;if(!pageToken)break;}
 return out.slice(0,MAX_EVENTS);}
export const fetchEvents=(provider:Provider,fetcher:Fetch,token:string,from:Date,to:Date)=>provider==='microsoft'?fetchMicrosoft(fetcher,token,from,to):fetchGoogle(fetcher,token,from,to);
```

- [ ] **Step 4: Rodar os testes**

Run: `node --experimental-strip-types --test tests/calendar-providers.test.mjs`
Expected: PASS, 5 testes.

Run: `npm test` — Expected: `ℹ pass 93`, `ℹ fail 0`.
Run: `npx eslint lib/calendar-providers.ts` — Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/calendar-providers.ts tests/calendar-providers.test.mjs package.json
git commit -m "Leitura das agendas pelo Microsoft Graph e pela Google Calendar API"
```

---

### Task 3: Sincronização do espelho

**Files:**
- Create: `lib/calendar-sync.ts`
- Create: `tests/calendar-sync.test.mjs`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Consumes: `fetchEvents`, `ProviderError`, `Fetch` (Tarefa 2); `hasScope`, `ExternalEvent`, `FeedStatus`, `FeedView`, `Provider` (Tarefa 1).
- Produces (usado pelas Tarefas 4 e 5):
  - `type FeedRow={userId;provider;account;events:ExternalEvent[];syncedAt:string|null;status:FeedStatus;error:string|null;connectedAt:string}`.
  - `type FeedStore={list(userId);get(userId,provider);create(row);update(row);remove(userId,provider?);all()}` (todos `Promise`). `update` só altera linha existente; `create` não sobrescreve.
  - `type SyncDeps={store:FeedStore;getToken(userId,provider):Promise<{token:string;scopes?:string[]}|null>;account(userId,provider):Promise<string>;fetch:Fetch;now?:()=>Date}`.
  - `syncFeed(d,row):Promise<FeedRow>`; `connectFeed(d,userId,provider,existing:FeedRow|null):Promise<FeedRow>`; `refreshFeed(d,userId,provider):Promise<FeedRow>`; `ensureFresh(d,userId,maxAgeMs):Promise<FeedRow[]>`; `loadExternal(d,userId,{maxAgeMs,budgetMs}):Promise<ExternalEvent[]>`; `syncAll(d,deadlineMs=45000):Promise<{total;synced;failed;skipped}>`; `calendarPayload(rows):{feeds:FeedView[];events:ExternalEvent[]}`.
  - Constantes `MIN_INTERVAL_MS=60000`, `EXTERNAL_FOR_AGENT={maxAgeMs:1800000,budgetMs:5000}`.

- [ ] **Step 1: Escrever os testes**

Criar `tests/calendar-sync.test.mjs`:

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncFeed,connectFeed,refreshFeed,ensureFresh,loadExternal,syncAll,calendarPayload} from '../lib/calendar-sync.ts';

const NOW=new Date('2026-10-18T12:00:00Z');
// Mesmo contrato do feedStore do banco: update só altera linha existente, create não sobrescreve.
function memoryStore(rows=[]){const key=(u,p)=>u+'|'+p;const map=new Map(rows.map(r=>[key(r.userId,r.provider),structuredClone(r)]));return {map,
 list:async u=>[...map.values()].filter(r=>r.userId===u),get:async(u,p)=>map.get(key(u,p))??null,
 create:async r=>{if(!map.has(key(r.userId,r.provider)))map.set(key(r.userId,r.provider),structuredClone(r));},
 update:async r=>{if(map.has(key(r.userId,r.provider)))map.set(key(r.userId,r.provider),structuredClone(r));},
 remove:async(u,p)=>{for(const k of [...map.keys()])if(k.startsWith(u+'|')&&(!p||k===key(u,p)))map.delete(k);},
 all:async()=>[...map.values()]};}
const graphEvent={id:'m1',subject:'Daily',start:{dateTime:'2026-10-20T12:00:00.0000000'},end:{dateTime:'2026-10-20T12:30:00.0000000'},isAllDay:false,isCancelled:false};
const googleEvent={id:'g1',summary:'Dentista',start:{dateTime:'2026-10-20T14:00:00-03:00'},end:{dateTime:'2026-10-20T15:00:00-03:00'}};
const respondOk=url=>url.includes('googleapis.com')?Response.json({items:[googleEvent]}):Response.json({value:[graphEvent]});
function deps({store=memoryStore(),token={token:'tok',scopes:['Calendars.Read','https://www.googleapis.com/auth/calendar.events.readonly']},respond=respondOk,account='voce@empresa.com'}={}){const calls=[];
 return {calls,deps:{store,now:()=>NOW,account:async()=>account,getToken:async(u,p)=>{calls.push('token:'+p);return typeof token==='function'?token(u,p):token;},fetch:async(url,init)=>{calls.push(url);return respond(url,init);}}};}
const row=(extra={})=>({userId:'u1',provider:'microsoft',account:'voce@empresa.com',events:[],syncedAt:null,status:'ok',error:null,connectedAt:'2026-10-01T00:00:00Z',...extra});
const old={id:'velho',provider:'microsoft',title:'Antigo',allDay:false,start:'2026-10-19T12:00:00Z',end:'2026-10-19T13:00:00Z'};

test('sincroniza de 30 dias atrás a 90 à frente e grava o espelho',async()=>{const store=memoryStore([row()]);const {deps:d,calls}=deps({store});
 const out=await syncFeed(d,row());
 assert.equal(out.status,'ok');assert.equal(out.error,null);assert.equal(out.syncedAt,'2026-10-18T12:00:00.000Z');
 assert.deepEqual(out.events,[{id:'m1',provider:'microsoft',title:'Daily',allDay:false,start:'2026-10-20T12:00:00Z',end:'2026-10-20T12:30:00Z'}]);
 assert.deepEqual(store.map.get('u1|microsoft'),out);assert.ok(calls[1].includes('startDateTime=2026-09-18T12%3A00%3A00.000Z&endDateTime=2027-01-16T12%3A00%3A00.000Z'));});
test('sem a permissão da agenda pede para reconectar e mantém o espelho',async()=>{const store=memoryStore([row({events:[old]})]);
 const {deps:d,calls}=deps({store,token:{token:'tok',scopes:['openid','User.Read']}});
 const out=await syncFeed(d,row({events:[old]}));assert.equal(out.status,'reconnect');assert.equal(out.error,'Precisa reconectar.');assert.deepEqual(out.events,[old]);assert.deepEqual(calls,['token:microsoft']);
 assert.equal((await syncFeed(deps({store,token:null}).deps,row())).status,'reconnect');});
test('token sem a lista de escopos tenta a API; 401 pede para reconectar',async()=>{const store=memoryStore([row()]);
 const {deps:d,calls}=deps({store,token:{token:'tok'},respond:()=>new Response('{}',{status:401})});
 const out=await syncFeed(d,row());assert.equal(calls.length,2);assert.equal(out.status,'reconnect');});
test('erro do provedor mantém o espelho anterior',async()=>{const store=memoryStore([row({events:[old]})]);const {deps:d}=deps({store,respond:()=>new Response('{}',{status:503})});
 const out=await syncFeed(d,row({events:[old]}));assert.equal(out.status,'error');assert.equal(out.error,'Não foi possível atualizar agora.');assert.equal(out.syncedAt,'2026-10-18T12:00:00.000Z');assert.deepEqual(store.map.get('u1|microsoft').events,[old]);});
test('desconectar durante a sincronização não recria a conta',async()=>{const store=memoryStore([row()]);
 const {deps:d}=deps({store,respond:async()=>{await store.remove('u1','microsoft');return Response.json({value:[graphEvent]});}});
 await syncFeed(d,row());assert.equal(store.map.size,0);});
test('conectar cria a conta com o e-mail e sincroniza; autorização negada não deixa conta para trás',async()=>{const store=memoryStore();
 const out=await connectFeed(deps({store}).deps,'u1','microsoft',null);assert.equal(out.status,'ok');assert.equal(out.account,'voce@empresa.com');assert.equal(out.connectedAt,'2026-10-18T12:00:00.000Z');assert.equal(store.map.get('u1|microsoft').events.length,1);
 const empty=memoryStore();const denied=await connectFeed(deps({store:empty,token:null}).deps,'u1','google',null);assert.equal(denied.status,'reconnect');assert.equal(empty.map.size,0);});
test('atualizar agora respeita um minuto, exceto quando precisa reconectar',async()=>{
 const a=deps({store:memoryStore([row({syncedAt:'2026-10-18T11:59:30Z'})])});assert.equal((await refreshFeed(a.deps,'u1','microsoft')).syncedAt,'2026-10-18T11:59:30Z');assert.deepEqual(a.calls,[]);
 const b=deps({store:memoryStore([row({syncedAt:'2026-10-18T11:58:00Z'})])});assert.equal((await refreshFeed(b.deps,'u1','microsoft')).syncedAt,'2026-10-18T12:00:00.000Z');
 const c=deps({store:memoryStore([row({syncedAt:'2026-10-18T11:59:50Z',status:'reconnect',account:'antigo@empresa.com'})])});const fixed=await refreshFeed(c.deps,'u1','microsoft');assert.equal(fixed.status,'ok');assert.equal(fixed.account,'voce@empresa.com');
 const nothing=memoryStore();assert.equal((await refreshFeed(deps({store:nothing}).deps,'u1','google')).status,'ok');assert.equal(nothing.map.size,1);});
test('ensureFresh sincroniza só os espelhos vencidos',async()=>{const store=memoryStore([row({syncedAt:'2026-10-18T11:55:00Z'}),row({provider:'google',syncedAt:'2026-10-18T11:40:00Z'})]);const {deps:d,calls}=deps({store});
 const rows=await ensureFresh(d,'u1',10*60*1000);
 assert.deepEqual(calls.filter(c=>c.startsWith('token:')),['token:google']);assert.equal(rows.find(r=>r.provider==='google').events[0].id,'g1');assert.equal(rows.find(r=>r.provider==='microsoft').syncedAt,'2026-10-18T11:55:00Z');});
test('assistente usa o espelho atual quando a sincronização demora',async()=>{
 const slow=deps({store:memoryStore([row({events:[old],syncedAt:'2026-10-18T10:00:00Z'})]),respond:()=>new Promise(()=>{})});
 assert.deepEqual(await loadExternal(slow.deps,'u1',{maxAgeMs:30*60*1000,budgetMs:20}),[old]);
 const fast=deps({store:memoryStore([row({events:[old],syncedAt:'2026-10-18T10:00:00Z'})])});
 assert.deepEqual((await loadExternal(fast.deps,'u1',{maxAgeMs:30*60*1000,budgetMs:1000})).map(e=>e.id),['m1']);});
test('cron vai da conta mais antiga para a mais nova, isola falhas e respeita o prazo',async()=>{const seen=[];
 const store=memoryStore([row({userId:'u1',syncedAt:'2026-10-18T09:00:00Z'}),row({userId:'u2',syncedAt:null})]);
 const {deps:d}=deps({store,token:u=>{seen.push(u);if(u==='u1')throw new Error('Clerk fora do ar');return {token:'tok',scopes:['Calendars.Read']};}});
 assert.deepEqual(await syncAll(d),{total:2,synced:1,failed:1,skipped:0});assert.deepEqual(seen,['u2','u1']);assert.equal(store.map.get('u1|microsoft').status,'error');
 assert.deepEqual(await syncAll(d,0),{total:2,synced:0,failed:0,skipped:2});});
test('resposta da API traz as contas sem os eventos e a lista de eventos',()=>{
 const p=calendarPayload([row({events:[old],syncedAt:'2026-10-18T11:00:00Z'}),row({provider:'google',status:'reconnect',error:'Precisa reconectar.'})]);
 assert.deepEqual(p.feeds,[{provider:'microsoft',account:'voce@empresa.com',status:'ok',syncedAt:'2026-10-18T11:00:00Z'},{provider:'google',account:'voce@empresa.com',status:'reconnect',error:'Precisa reconectar.'}]);assert.deepEqual(p.events,[old]);});
```

- [ ] **Step 2: Incluir no script e ver falhar**

Em `package.json`, acrescentar ` tests/calendar-sync.test.mjs` ao fim do script `test`.

Run: `node --experimental-strip-types --test tests/calendar-sync.test.mjs`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` para `lib/calendar-sync.ts`.

- [ ] **Step 3: Implementar**

Criar `lib/calendar-sync.ts`:

```ts
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
 try{const t=await d.getToken(row.userId,row.provider);if(!t?.token||!hasScope(row.provider,t.scopes))throw new ProviderError('reconnect');
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
// "Conectar" e "Atualizar agora": conta nova ou com problema passa pela conexão; conta em dia sincroniza no máximo uma vez por minuto.
export async function refreshFeed(d:SyncDeps,userId:string,provider:Provider):Promise<FeedRow>{const row=await d.store.get(userId,provider);
 if(!row||row.status!=='ok')return connectFeed(d,userId,provider,row);
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
```

- [ ] **Step 4: Rodar os testes**

Run: `node --experimental-strip-types --test tests/calendar-sync.test.mjs`
Expected: PASS, 11 testes (a mensagem `calendar sync microsoft Clerk fora do ar` no console é esperada).

Run: `npm test` — Expected: `ℹ pass 104`, `ℹ fail 0`.
Run: `npx eslint lib/calendar-sync.ts` — Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/calendar-sync.ts tests/calendar-sync.test.mjs package.json
git commit -m "Sincronização do espelho das agendas externas"
```

---

### Task 4: Banco, Clerk, rotas e cron

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0002_*.sql` e `drizzle/meta/0002_snapshot.json` (gerados), `drizzle/meta/_journal.json`
- Create: `lib/calendar-server.ts`
- Create: `app/api/calendar/route.ts`
- Create: `app/api/cron/calendar-sync/route.ts`
- Modify: `vercel.json`
- Modify: `app/api/state/route.ts`

**Interfaces:**
- Consumes: `FeedRow`, `FeedStore`, `SyncDeps`, `refreshFeed`, `ensureFresh`, `syncAll`, `calendarPayload` (Tarefa 3); `PROVIDERS`, `Provider`, `ExternalEvent`, `FeedStatus`, `FRESH_MS` (Tarefa 1).
- Produces:
  - `feedStore:FeedStore` e `calendarDeps():SyncDeps` em `lib/calendar-server.ts` (usados pelas Tarefas 5 e pelas rotas).
  - `GET /api/calendar` → `{feeds:FeedView[];events:ExternalEvent[]}`; `POST /api/calendar` com `{provider}` → o mesmo + `result:{provider,status,count}`; com `{}` → o mesmo sem `result`; `DELETE /api/calendar` com `{provider}` → o mesmo. Erros `{error}` com 400/401/403/503.

- [ ] **Step 1: Tabela no esquema**

Em `db/schema.ts`, acrescentar ao fim:

```ts
// Espelho das agendas externas (Outlook e Google) por usuário e provedor; events guarda o JSON da última sincronização boa.
export const calendarFeeds=pgTable("calendar_feeds",{userId:text("user_id").notNull(),provider:text("provider").notNull(),account:text("account").notNull().default(""),events:text("events").notNull().default("[]"),syncedAt:text("synced_at"),status:text("status").notNull().default("ok"),error:text("error"),connectedAt:text("connected_at").notNull()},t=>[primaryKey({columns:[t.userId,t.provider]})]);
```

- [ ] **Step 2: Gerar a migração**

Run: `npm run db:generate`
Expected: cria `drizzle/0002_<nome>.sql` com:

```sql
CREATE TABLE "calendar_feeds" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"account" text DEFAULT '' NOT NULL,
	"events" text DEFAULT '[]' NOT NULL,
	"synced_at" text,
	"status" text DEFAULT 'ok' NOT NULL,
	"error" text,
	"connected_at" text NOT NULL,
	CONSTRAINT "calendar_feeds_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
```

e atualiza `drizzle/meta/_journal.json` com a entrada `idx: 2`. Conferir que o SQL não mexe em outras tabelas.

- [ ] **Step 3: Ligação com banco e Clerk**

Criar `lib/calendar-server.ts`:

```ts
import {eq,and} from 'drizzle-orm';import {clerkClient} from '@clerk/nextjs/server';import {getDb} from '@/db';import {calendarFeeds} from '@/db/schema';import type {FeedRow,FeedStore,SyncDeps} from './calendar-sync';import type {ExternalEvent,FeedStatus,Provider} from './external-calendar';
// Liga a sincronização das agendas ao banco (calendar_feeds), aos tokens guardados pelo Clerk e à rede.
const parse=(text:string):ExternalEvent[]=>{try{const v=JSON.parse(text);return Array.isArray(v)?v:[];}catch{return [];}};
const toRow=(r:typeof calendarFeeds.$inferSelect):FeedRow=>({userId:r.userId,provider:r.provider as Provider,account:r.account,events:parse(r.events),syncedAt:r.syncedAt,status:r.status as FeedStatus,error:r.error,connectedAt:r.connectedAt});
const columns=(r:FeedRow)=>({account:r.account,events:JSON.stringify(r.events),syncedAt:r.syncedAt,status:r.status,error:r.error});
const match=(userId:string,provider:Provider)=>and(eq(calendarFeeds.userId,userId),eq(calendarFeeds.provider,provider));
export const feedStore:FeedStore={
 list:async userId=>(await getDb().select().from(calendarFeeds).where(eq(calendarFeeds.userId,userId))).map(toRow),
 get:async(userId,provider)=>{const row=(await getDb().select().from(calendarFeeds).where(match(userId,provider)).limit(1))[0];return row?toRow(row):null;},
 create:async r=>{await getDb().insert(calendarFeeds).values({userId:r.userId,provider:r.provider,connectedAt:r.connectedAt,...columns(r)}).onConflictDoNothing();},
 update:async r=>{await getDb().update(calendarFeeds).set(columns(r)).where(match(r.userId,r.provider));},
 remove:async(userId,provider)=>{await getDb().delete(calendarFeeds).where(provider?match(userId,provider):eq(calendarFeeds.userId,userId));},
 all:async()=>(await getDb().select().from(calendarFeeds)).map(toRow)};
// O Clerk renova o token quando preciso. Conta não ligada (erro 4xx do Clerk) conta como "sem token".
async function getToken(userId:string,provider:Provider){try{const res=await (await clerkClient()).users.getUserOauthAccessToken(userId,provider);const t=res.data[0];return t?.token?{token:t.token,scopes:t.scopes}:null;}
 catch(e){const status=(e as {status?:number}).status;if(status&&status>=400&&status<500)return null;throw e;}}
async function account(userId:string,provider:Provider){const user=await (await clerkClient()).users.getUser(userId);return user.externalAccounts.find(x=>x.provider===provider||x.provider==='oauth_'+provider)?.emailAddress||'';}
export const calendarDeps=():SyncDeps=>({store:feedStore,getToken,account,fetch:(url,init)=>fetch(url,init)});
```

- [ ] **Step 4: Rota do app**

Criar `app/api/calendar/route.ts`:

```ts
import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {calendarDeps,feedStore} from '@/lib/calendar-server';import {refreshFeed,ensureFresh,calendarPayload} from '@/lib/calendar-sync';import {PROVIDERS,FRESH_MS,type Provider} from '@/lib/external-calendar';
export const dynamic='force-dynamic';export const maxDuration=60;
// Agendas externas do usuário logado. GET lê só o banco; POST conecta, força ou completa a sincronização; DELETE desconecta.
const reply=(body:unknown)=>Response.json(body,{headers:{'Cache-Control':'no-store'}});
const providerOf=(value:unknown)=>PROVIDERS.includes(value as Provider)?value as Provider:null;
async function bodyOf(request:Request):Promise<{provider?:unknown}>{try{const j=await request.json();return j&&typeof j==='object'?j:{};}catch{return {};}}
const failed=(where:string,e:unknown)=>{console.error(where,e instanceof Error?e.message:'erro');return jsonError('Não foi possível falar com a agenda externa agora.',503);};
export async function GET(){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);
 try{return reply(calendarPayload(await feedStore.list(userId)));}catch(e){return failed('calendar:get',e);}}
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 const body=await bodyOf(request),deps=calendarDeps();
 try{if(body.provider===undefined){await ensureFresh(deps,userId,FRESH_MS);return reply(calendarPayload(await feedStore.list(userId)));}
  const provider=providerOf(body.provider);if(!provider)return jsonError('Agenda não reconhecida');
  const row=await refreshFeed(deps,userId,provider);
  return reply({...calendarPayload(await feedStore.list(userId)),result:{provider,status:row.status,count:row.events.length}});}
 catch(e){return failed('calendar:sync',e);}}
export async function DELETE(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 const provider=providerOf((await bodyOf(request)).provider);if(!provider)return jsonError('Agenda não reconhecida');
 try{await feedStore.remove(userId,provider);return reply(calendarPayload(await feedStore.list(userId)));}catch(e){return failed('calendar:delete',e);}}
```

- [ ] **Step 5: Cron diário**

Criar `app/api/cron/calendar-sync/route.ts`:

```ts
import {calendarDeps} from '@/lib/calendar-server';import {syncAll} from '@/lib/calendar-sync';
export const dynamic='force-dynamic';export const maxDuration=60;
// Chamada pela tarefa agendada da Vercel, que envia Authorization: Bearer <CRON_SECRET>. Responde só com contagens.
export async function GET(request:Request){const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 return Response.json(await syncAll(calendarDeps()));}
```

Em `vercel.json`, trocar a linha `"crons": [{ "path": "/api/cron/trt-reminders", "schedule": "0 11 * * *" }]` por:

```json
  "crons": [
    { "path": "/api/cron/trt-reminders", "schedule": "0 11 * * *" },
    { "path": "/api/cron/calendar-sync", "schedule": "0 9 * * *" }
  ]
```

- [ ] **Step 6: "Apagar meus dados" apaga as conexões**

Em `app/api/state/route.ts`:
- No fim da linha 1 (imports), acrescentar `import {feedStore} from '@/lib/calendar-server';`.
- Trocar o comentário `// "Apagar meus dados" também remove os arquivos dos exames; uma falha aqui não desfaz a limpeza dos registros.` por `// "Apagar meus dados" também remove os arquivos dos exames e as agendas conectadas; uma falha aqui não desfaz a limpeza dos registros.`
- Logo depois da linha `if(command.type==='reset')await examFiles()?.removePrefix(...)...;`, acrescentar:

```ts
 if(command.type==='reset')await feedStore.remove(userId).catch(e=>console.error('calendar:reset',e instanceof Error?e.message:'erro'));
```

- [ ] **Step 7: Verificar**

Run: `npm run typecheck` — Expected: sem erros.
Run: `npx eslint lib/calendar-server.ts app/api/calendar/route.ts app/api/cron/calendar-sync/route.ts app/api/state/route.ts db/schema.ts` — Expected: sem erros.
Run: `npm test` — Expected: `ℹ pass 104`, `ℹ fail 0`.
Run: `npm run build` — Expected: build conclui e lista `ƒ /api/calendar` e `ƒ /api/cron/calendar-sync`.

- [ ] **Step 8: Commit**

```bash
git add db/schema.ts drizzle lib/calendar-server.ts app/api/calendar/route.ts app/api/cron/calendar-sync/route.ts vercel.json app/api/state/route.ts
git commit -m "Tabela, rotas e cron da sincronização das agendas externas"
```

---

### Task 5: Assistente e Telegram enxergam os compromissos externos

**Files:**
- Modify: `lib/agent.ts:4,16-25` (`agendaRange`)
- Modify: `lib/agent-runtime.ts` (imports, `agentInstructions`, `agentTools`)
- Modify: `app/api/assistant/route.ts`
- Modify: `app/api/telegram/route.ts`
- Test: `tests/agent.test.mjs`

**Interfaces:**
- Consumes: `agendaItems`, `agendaOrder`, `ExternalEvent` (Tarefa 1); `loadExternal`, `EXTERNAL_FOR_AGENT` (Tarefa 3); `calendarDeps` (Tarefa 4).
- Produces: `agendaRange(s,start,end,external:ExternalEvent[]=[])` — itens externos como `{title,time?,endTime?,type:'outlook'|'google',readOnly:true}`; `agentTools(state,today,onProposals,external:ExternalEvent[]=[])`.

- [ ] **Step 1: Escrever o teste**

Em `tests/agent.test.mjs`, acrescentar ao fim:

```js
test('agenda inclui compromissos do Outlook e do Google como só leitura',()=>{const external=[{id:'m1',provider:'microsoft',title:'Daily',allDay:false,start:'2026-10-16T12:00:00Z',end:'2026-10-16T12:30:00Z'},{id:'g1',provider:'google',title:'Feriado',allDay:true,start:'2026-10-16',end:'2026-10-17'}];
 const [day]=agendaRange(workspace(),'2026-10-16','2026-10-16',external);
 assert.deepEqual(day.items,[{title:'Feriado',type:'google',readOnly:true},{title:'Correr',time:'07:00',type:'habit',done:true},{title:'Daily',time:'09:00',endTime:'09:30',type:'outlook',readOnly:true}]);});
```

- [ ] **Step 2: Ver falhar**

Run: `node --experimental-strip-types --test tests/agent.test.mjs`
Expected: FAIL no teste novo (os itens externos não aparecem).

- [ ] **Step 3: Implementar `agendaRange`**

Em `lib/agent.ts`:
- Depois da linha 4 (`import { validDate, addDays, scheduledItems, ... } from './core.ts';`), acrescentar `import { agendaItems, agendaOrder, type ExternalEvent } from './external-calendar.ts';`. Retirar `scheduledItems` desse import se não for mais usado no arquivo (conferir com `grep -n scheduledItems lib/agent.ts`).
- Substituir a função `agendaRange` inteira por:

```ts
export function agendaRange(s:Workspace,start:string,end:string,external:ExternalEvent[]=[]){
 if(!validDate(start)||!validDate(end)||end<start)throw new Error('Período inválido');
 const days:{date:string;items:{title:string;time?:string;endTime?:string;type:string;done?:boolean;readOnly?:boolean}[]}[]=[];
 for(let d=start;d<=end;d=addDays(d,1)){
  if(days.length>=31)throw new Error('Consulte no máximo 31 dias por vez');
  // Compromissos do Outlook e do Google vêm marcados como só leitura e sem conclusão.
  const items=agendaItems(s,external,d).sort(agendaOrder);
  days.push({date:d,items:items.map(x=>x._collection==='external'?{title:x.title,...(x.time?{time:x.time}:{}),...(x.endTime?{endTime:x.endTime}:{}),type:x.provider==='microsoft'?'outlook':'google',readOnly:true}:{title:x.title,...(x.time?{time:x.time}:{}),type:x.type||'task',done:!!isComplete(s,x,d)})});
 }
 return days;
}
```

- [ ] **Step 4: Rodar o teste**

Run: `node --experimental-strip-types --test tests/agent.test.mjs`
Expected: PASS em todos, inclusive os testes antigos de agenda.

- [ ] **Step 5: Ferramenta e instruções do assistente**

Em `lib/agent-runtime.ts`:
- No fim da linha 1, acrescentar `import type {ExternalEvent} from './external-calendar';`.
- Em `agentInstructions`, logo depois da linha `Consulte as ferramentas antes de falar sobre agenda, finanças ou registros do usuário. Nunca invente dados.`, acrescentar a linha (dentro do mesmo template literal):

```
Itens do tipo outlook ou google vêm da agenda externa do usuário e são só leitura: mostre-os, mas nunca proponha editar, concluir ou apagar.
```

- Trocar `export function agentTools(state:Workspace,today:string,onProposals:(items:Proposal[])=>void){return {` por `export function agentTools(state:Workspace,today:string,onProposals:(items:Proposal[])=>void,external:ExternalEvent[]=[]){return {`.
- Na ferramenta `agenda`, trocar a descrição `'Lista tarefas, hábitos, compromissos, tarefas de casa e estudos de cada dia do período, com horário e se foram concluídos.'` por `'Lista tarefas, hábitos, compromissos, tarefas de casa e estudos de cada dia do período, com horário e se foram concluídos, e os compromissos do Outlook e do Google (type outlook ou google, só leitura).'` e trocar `agendaRange(state,inicio.slice(0,10),(fim||inicio).slice(0,10))` por `agendaRange(state,inicio.slice(0,10),(fim||inicio).slice(0,10),external)`.

- [ ] **Step 6: Rotas do assistente e do Telegram**

Em `app/api/assistant/route.ts`:
- No fim da linha 1, acrescentar `import {loadExternal,EXTERNAL_FOR_AGENT} from '@/lib/calendar-sync';import {calendarDeps} from '@/lib/calendar-server';`.
- Trocar ` const stream=createUIMessageStream<AgentMessage>({execute:async({writer})=>{` por:

```ts
 const external=await loadExternal(calendarDeps(),userId,EXTERNAL_FOR_AGENT);
 const stream=createUIMessageStream<AgentMessage>({execute:async({writer})=>{
```

- Trocar `tools:agentTools(state,today,items=>writer.write({type:'data-proposals',data:{items}}))});` por `tools:agentTools(state,today,items=>writer.write({type:'data-proposals',data:{items}}),external)});`.

Em `app/api/telegram/route.ts`:
- No fim da linha 1, acrescentar `import {loadExternal,EXTERNAL_FOR_AGENT} from '@/lib/calendar-sync';import {calendarDeps} from '@/lib/calendar-server';`.
- Trocar ` else{try{const messages=[...link.history` por ` else{try{const external=await loadExternal(calendarDeps(),link.userId,EXTERNAL_FOR_AGENT);const messages=[...link.history`.
- Trocar `tools:agentTools(state,today,items=>proposals.push(...items)),stopWhen` por `tools:agentTools(state,today,items=>proposals.push(...items),external),stopWhen`.

- [ ] **Step 7: Verificar**

Run: `npm test` — Expected: `ℹ pass 105`, `ℹ fail 0`.
Run: `npm run typecheck` — Expected: sem erros.
Run: `npx eslint lib/agent.ts lib/agent-runtime.ts app/api/assistant/route.ts app/api/telegram/route.ts` — Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add lib/agent.ts lib/agent-runtime.ts app/api/assistant/route.ts app/api/telegram/route.ts tests/agent.test.mjs
git commit -m "Assistente e Telegram mostram os compromissos do Outlook e do Google"
```

---

### Task 6: Agenda e painel inicial mostram os externos

**Files:**
- Modify: `components/norte/context.tsx`
- Modify: `components/norte/NorteApp.tsx:7,11,28,33`
- Modify: `components/norte/planning.tsx:2-6,11,13-14,18,22`
- Modify: `app/globals.css` (fim do arquivo)

**Interfaces:**
- Consumes: `agendaItems`, `agendaOrder`, `externalWhen`, `PROVIDER_LABEL`, `isStale`, `FRESH_MS`, `ExternalEvent`, `FeedView`, `FeedStatus`, `Provider` (Tarefa 1); rotas `/api/calendar` (Tarefa 4).
- Produces (usado pela Tarefa 7):
  - `type CalendarResult={provider:Provider;status:FeedStatus;count:number}` exportado de `context.tsx`.
  - `AppContext.calendar:{events:ExternalEvent[];feeds:FeedView[];refresh:(provider?:Provider)=>Promise<CalendarResult|null>;disconnect:(provider:Provider)=>Promise<boolean>}`. `refresh` e `disconnect` já mostram o aviso de erro de rede; devolvem `null`/`false` nesse caso.

- [ ] **Step 1: Contexto**

Substituir `components/norte/context.tsx` por:

```tsx
'use client';
import {createContext,useContext} from 'react';import type {Workspace,Command,Collection,Item} from '@/lib/types';import type {ExternalEvent,FeedStatus,FeedView,Provider} from '@/lib/external-calendar';
export type CalendarResult={provider:Provider;status:FeedStatus;count:number};
export type CalendarState={events:ExternalEvent[];feeds:FeedView[];refresh:(provider?:Provider)=>Promise<CalendarResult|null>;disconnect:(provider:Provider)=>Promise<boolean>};
export type AppContext={state:Workspace;today:string;date:string;setDate:(d:string)=>void;navigate:(p:string)=>void;mutate:(c:Command)=>Promise<boolean>;sync:(r:{state:Workspace;version:number})=>void;edit:(collection:Collection,item?:Item,defaults?:any,installments?:boolean)=>void;remove:(collection:Collection,item:Item)=>void;toast:(message:string,error?:boolean)=>void;openAssistant:()=>void;busy:boolean;user:{name:string;email:string};calendar:CalendarState};
export const Context=createContext<AppContext>(null as any);export const useApp=()=>useContext(Context);
```

- [ ] **Step 2: Carga e sincronização em segundo plano**

Em `components/norte/NorteApp.tsx`:
- Depois da linha 7 (`import {todayInZone,formatMoney,addDays} from '@/lib/core';`), acrescentar `import {isStale,FRESH_MS,type ExternalEvent,type FeedView,type Provider} from '@/lib/external-calendar';`.
- Trocar `import {Context} from './context';` por `import {Context,type CalendarResult} from './context';`.
- Depois da linha 28 (` const edit=useCallback(...);`) e antes de ` if(!data)return`, acrescentar:

```tsx
 // Agendas externas: o GET lê só o banco; se algum espelho passou de 10 minutos, a sincronização roda em segundo plano.
 const [calendar,setCalendar]=useState<{events:ExternalEvent[];feeds:FeedView[]}>({events:[],feeds:[]});
 const callCalendar=useCallback(async(method:'GET'|'POST'|'DELETE',body?:object)=>{const r=await fetch('/api/calendar',{method,cache:'no-store',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const j=await r.json() as {error?:string;events:ExternalEvent[];feeds:FeedView[];result?:CalendarResult};if(!r.ok)throw new Error(j.error||'Não foi possível falar com a agenda externa.');setCalendar({events:j.events,feeds:j.feeds});return j;},[]);
 useEffect(()=>{callCalendar('GET').then(j=>isStale(j.feeds,Date.now(),FRESH_MS)?callCalendar('POST',{}):null).catch(()=>{});},[callCalendar]);
 const refreshCalendar=useCallback(async(provider?:Provider)=>{try{return (await callCalendar('POST',provider?{provider}:{})).result??null;}catch(e){toast(e instanceof Error?e.message:'Não foi possível atualizar a agenda externa.',true);return null;}},[callCalendar,toast]);
 const disconnectCalendar=useCallback(async(provider:Provider)=>{try{await callCalendar('DELETE',{provider});return true;}catch(e){toast(e instanceof Error?e.message:'Não foi possível desconectar agora.',true);return false;}},[callCalendar,toast]);
```

- Na linha do `const context={...}`, trocar `openAssistant:()=>setAssistant(true),busy,user:data.user};` por `openAssistant:()=>setAssistant(true),busy,user:data.user,calendar:{...calendar,refresh:refreshCalendar,disconnect:disconnectCalendar}};`.

- [ ] **Step 3: Linhas externas e resumo do evento em `planning.tsx`**

Edições em `components/norte/planning.tsx` (cada trecho antigo aparece uma vez):

1. Linha 2: trocar `NotebookPen,CheckCheck} from 'lucide-react';` por `NotebookPen,CheckCheck,MapPin,Video} from 'lucide-react';`.
2. Linha 3: trocar `import {doseId} from '@/lib/testosterone';import type {Item} from '@/lib/types';` por `import {doseId} from '@/lib/testosterone';import type {Item} from '@/lib/types';import {agendaItems,agendaOrder,externalWhen,PROVIDER_LABEL,type Provider} from '@/lib/external-calendar';`.
3. Trocar a linha `const openItem=(a:AppContext,t:Item)=>t._collection==='trtProtocols'?a.navigate('/testosterona'):a.edit(t._collection||'tasks',t);` por:

```tsx
// Compromissos do Outlook e do Google são só leitura: abrir mostra o resumo.
const openItem=(a:AppContext,t:Item,show:(t:Item)=>void)=>t._collection==='external'?show(t):t._collection==='trtProtocols'?a.navigate('/testosterona'):a.edit(t._collection||'tasks',t);
```

4. Trocar `export function WeekStrip(` por:

```tsx
function ExternalEventModal({item,date,onClose}:{item:Item;date:string;onClose:()=>void}){return <Modal title={item.title} subtitle={PROVIDER_LABEL[item.provider as Provider]+' · só leitura'} onClose={onClose}><div className="external-detail"><p><CalendarDays size={15}/>{formatDate(date,{weekday:'long',day:'numeric',month:'long'})} · {externalWhen(item)}</p>{item.location&&<p><MapPin size={15}/>{item.location}</p>}</div><div className="modal-footer">{item.webLink&&<a className="button ghost" href={item.webLink} target="_blank" rel="noreferrer">{item.provider==='microsoft'?'Abrir no Outlook':'Abrir no Google Agenda'}<ArrowUpRight size={15}/></a>}{item.joinUrl&&<a className="button primary" href={item.joinUrl} target="_blank" rel="noreferrer"><Video size={16}/>Entrar na reunião</a>}</div></Modal>;}
export function WeekStrip(
```

5. Em `TaskList`:
   - trocar `{const a=useApp();if(!items.length)return empty?` por `{const a=useApp();const [shown,setShown]=useState<Item|null>(null);if(!items.length)return empty?`;
   - trocar `return <div className="task-list">{items.map(t=>{const done=isComplete(a.state,t,date);` por:

```tsx
return <div className="task-list">{items.map(t=>{if(t._collection==='external')return <div className="task-row external" key={t.id}><span className="task-check external-mark" aria-hidden="true"><CalendarDays size={11}/></span><div className="task-main"><button onClick={()=>setShown(t)} className="task-title">{t.title}</button><div className="task-meta"><span className="pill external">{PROVIDER_LABEL[t.provider as Provider]}</span><span><Clock size={11}/>{externalWhen(t)}</span></div></div></div>;const done=isComplete(a.state,t,date);
```

   - trocar `<button onClick={()=>openItem(a,t)} className="task-title">` por `<button onClick={()=>openItem(a,t,setShown)} className="task-title">`;
   - trocar `onEdit={()=>openItem(a,t)} onDelete=` por `onEdit={()=>openItem(a,t,setShown)} onDelete=`;
   - trocar `onDelete={()=>a.remove((t._collection||'tasks'),t)}/>}</div>;})}</div>;}` por `onDelete={()=>a.remove((t._collection||'tasks'),t)}/>}</div>;})}{shown&&<ExternalEventModal item={shown} date={date} onClose={()=>setShown(null)}/>}</div>;}`.

- [ ] **Step 4: Painel inicial**

Em `HomeView` (`planning.tsx`):
- Trocar `const tasks=scheduledItems(state,date).sort((x,y)=>(x.time||'99').localeCompare(y.time||'99'));const done=` por `const items=agendaItems(state,a.calendar.events,date).sort(agendaOrder);const tasks=items.filter(t=>t._collection!=='external');const done=`.
- Trocar a linha ` const visible=tasks.filter(t=>filter==='all'||(filter==='done'?isComplete(state,t,date):!isComplete(state,t,date)));` por:

```tsx
 // Compromissos externos não se concluem no GeoAI: aparecem só em "Todas" e não entram no progresso.
 const visible=items.filter(t=>t._collection==='external'?filter==='all':filter==='all'||(filter==='done'?isComplete(state,t,date):!isComplete(state,t,date)));
```

- Trocar `<>{groups.map(g=>{` por `<>{visible.some(t=>t.allDay)&&<div className="period"><h4><CalendarDays size={14}/>Dia inteiro<span>{visible.filter(t=>t.allDay).length}</span></h4><TaskList items={visible.filter(t=>t.allDay)} date={date}/></div>}{groups.map(g=>{`.
- Trocar `{visible.some(t=>!t.time)&&<div className="period"><h4><Clock size={14}/>No seu tempo<span>{visible.filter(t=>!t.time).length}</span></h4><TaskList items={visible.filter(t=>!t.time)} date={date}/></div>}` por `{visible.some(t=>!t.time&&!t.allDay)&&<div className="period"><h4><Clock size={14}/>No seu tempo<span>{visible.filter(t=>!t.time&&!t.allDay).length}</span></h4><TaskList items={visible.filter(t=>!t.time&&!t.allDay)} date={date}/></div>}`.

- [ ] **Step 5: Agenda (Dia, Semana, Mês)**

Em `AgendaView` (`planning.tsx`):
- Trocar `export function AgendaView(){const a=useApp();const [view,setView]=useState('day');const tasks=scheduledItems(a.state,a.date);` por `export function AgendaView(){const a=useApp();const [view,setView]=useState('day');const [shown,setShown]=useState<{item:Item;date:string}|null>(null);const on=(d:string)=>agendaItems(a.state,a.calendar.events,d).sort(agendaOrder);const items=on(a.date),tasks=items.filter(t=>t._collection!=='external'),external=items.length-tasks.length;`.
- Trocar `<span>{scheduledItems(a.state,d).slice(0,3).map(t=><small key={t.id}>{t.title}</small>)}</span>` por `<span>{on(d).slice(0,3).map(t=><small key={t.id}>{t.title}</small>)}</span>`.
- Trocar `{scheduledItems(a.state,d).map(t=><button key={t.id} className="agenda-chip" onClick={()=>openItem(a,t)}><small>{t.time||'Sem horário'}</small>{t.title}</button>)}` por `{on(d).map(t=><button key={t.id} className={'agenda-chip'+(t._collection==='external'?' external':'')} onClick={()=>openItem(a,t,item=>setShown({item,date:d}))}><small>{t._collection==='external'?PROVIDER_LABEL[t.provider as Provider]+' · '+externalWhen(t):t.time||'Sem horário'}</small>{t.title}</button>)}`.
- Trocar `<span>{tasks.length} ações · {tasks.reduce((sum,t)=>sum+(t.duration||0),0)} min planejados</span></div><TaskList date={a.date} items={tasks.sort((x,y)=>(x.time||'99').localeCompare(y.time||'99'))}/></>}</section></>;}` por `<span>{tasks.length} ações · {tasks.reduce((sum,t)=>sum+(t.duration||0),0)} min planejados{external?' · '+external+' da agenda externa':''}</span></div><TaskList date={a.date} items={items}/></>}</section>{shown&&<ExternalEventModal {...shown} onClose={()=>setShown(null)}/>}</>;}`.

- [ ] **Step 6: Estilos**

Acrescentar ao fim de `app/globals.css`:

```css
.task-check.external-mark{border-style:dashed;color:var(--muted)}
.pill.external{background:var(--surface-2);color:var(--text)}
.agenda-chip.external{background:var(--surface-2)}
.external-detail p{display:flex;gap:9px;align-items:center;font-size:13px;color:var(--muted);padding:10px 0;border-bottom:1px solid var(--border)}
```

- [ ] **Step 7: Verificar**

Run: `npm run typecheck` — Expected: sem erros.
Run: `npx eslint components/norte/planning.tsx components/norte/NorteApp.tsx components/norte/context.tsx` — Expected: no máximo 2, 13 e 2 erros (linha de base); nenhum erro em linhas novas.
Run: `npm test` — Expected: `ℹ pass 105`, `ℹ fail 0`.
Run: `npm run build` — Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add components/norte/context.tsx components/norte/NorteApp.tsx components/norte/planning.tsx app/globals.css
git commit -m "Agenda e painel inicial mostram os compromissos do Outlook e do Google"
```

---

### Task 7: Conectar Outlook / Teams e Google em Configurações

**Files:**
- Modify: `components/norte/settings.tsx` (imports, seção "Calendário & lembretes", componente novo no fim)
- Modify: `app/globals.css` (fim do arquivo)

**Interfaces:**
- Consumes: `AppContext.calendar`, `CalendarResult` (Tarefa 6); `PROVIDERS`, `OAUTH_SCOPES`, `hasScope`, `timeAgo`, `Provider` (Tarefa 1); `useUser`, `useReverification` de `@clerk/nextjs`; `OAuthStrategy` de `@clerk/nextjs/types`.
- Produces: componente `CalendarAccounts` (interno ao arquivo).

- [ ] **Step 1: Imports**

Em `components/norte/settings.tsx`:
- Trocar `import {SignOutButton} from '@clerk/nextjs';` por `import {SignOutButton,useUser,useReverification} from '@clerk/nextjs';import type {OAuthStrategy} from '@clerk/nextjs/types';`.
- Trocar `import {useApp} from './context';` por `import {useApp,type CalendarResult} from './context';`.
- Trocar `import type {Proposal} from '@/lib/types';` por `import type {Proposal} from '@/lib/types';import {PROVIDERS,OAUTH_SCOPES,hasScope,timeAgo,type Provider} from '@/lib/external-calendar';`.

- [ ] **Step 2: Colocar o cartão na seção**

Trocar `<header className="section-heading"><h2>Calendário & lembretes</h2></header><div className="setting-row"><span className="icon-tile"><CalendarDays size={20}/></span><div><h3>Seu calendário onde você preferir</h3>` por `<header className="section-heading"><h2>Calendário & lembretes</h2></header><CalendarAccounts/><div className="setting-row border-top"><span className="icon-tile"><CalendarDays size={20}/></span><div><h3>Seu calendário onde você preferir</h3>`.

- [ ] **Step 3: Componente**

Acrescentar ao fim de `components/norte/settings.tsx`:

```tsx
const ACCOUNT:Record<Provider,{title:string;name:string;hint:string}>={microsoft:{title:'Outlook / Teams',name:'Outlook',hint:'Reuniões do Teams e compromissos do Outlook, da empresa ou pessoal.'},google:{title:'Google Agenda',name:'Google Agenda',hint:'Compromissos da agenda principal da sua conta Google.'}};
const CONNECT_FAILED='Não foi possível conectar. Se for uma conta da empresa, ela pode precisar aprovar o GeoAI no Microsoft 365.';
// Volta da autorização do Google ou da Microsoft: /perfil?agenda=<provedor>.
const returned=()=>{const p=new URLSearchParams(window.location.search).get('agenda');return PROVIDERS.includes(p as Provider)?p as Provider:null;};
// Agendas só leitura. O Clerk faz a autorização e guarda os tokens; o servidor sincroniza o espelho.
function CalendarAccounts(){const a=useApp();const {user}=useUser();const [busy,setBusy]=useState<Provider|null>(returned),[leaving,setLeaving]=useState<Provider|null>(null);const back=useRef(busy);
 const createExternal=useReverification((params:Parameters<NonNullable<typeof user>['createExternalAccount']>[0])=>user!.createExternalAccount(params));
 const announce=(r:CalendarResult|null,first:boolean)=>{if(!r)return;const name=ACCOUNT[r.provider].name;
  if(r.status==='ok')a.toast(first?name+' conectado: '+r.count+(r.count===1?' compromisso.':' compromissos.'):'Agenda atualizada.');
  else a.toast(r.status==='reconnect'?(first?CONNECT_FAILED:'Precisa reconectar o '+name+'.'):'Não foi possível atualizar agora. Tente de novo em instantes.',true);};
 useEffect(()=>{const p=back.current;if(!p)return;back.current=null;window.history.replaceState({},'',window.location.pathname);a.calendar.refresh(p).then(r=>announce(r,true)).finally(()=>setBusy(null));},[]);
 async function connect(p:Provider){if(!user)return;setBusy(p);
  try{const ext=user.externalAccounts.find(x=>x.provider===p),redirectUrl=window.location.origin+'/perfil?agenda='+p;
   // Conta já ligada com a permissão (por exemplo, quem entra com o Google): basta sincronizar.
   if(ext?.verification?.status==='verified'&&hasScope(p,ext.approvedScopes.split(' '))){announce(await a.calendar.refresh(p),true);return;}
   const account=ext?await ext.reauthorize({additionalScopes:OAUTH_SCOPES[p],redirectUrl}):await createExternal({strategy:('oauth_'+p) as OAuthStrategy,additionalScopes:OAUTH_SCOPES[p],redirectUrl});
   const url=account?.verification?.externalVerificationRedirectURL;if(!url)throw new Error('Sem endereço de autorização');window.location.href=url.href;}
  catch(e){console.error('calendar connect',e);a.toast('A conexão com o '+ACCOUNT[p].name+' ainda não foi ativada.',true);}
  finally{setBusy(null);}}
 async function refresh(p:Provider){setBusy(p);try{announce(await a.calendar.refresh(p),false);}finally{setBusy(null);}}
 async function disconnect(p:Provider){setBusy(p);if(await a.calendar.disconnect(p))a.toast(ACCOUNT[p].name+' desconectado.');setBusy(null);setLeaving(null);}
 const now=new Date().getTime();
 return <>{PROVIDERS.map(p=>{const feed=a.calendar.feeds.find(f=>f.provider===p);
  const line=!feed?'Não conectado':feed.status==='reconnect'?'Precisa reconectar':feed.status==='error'?'Não foi possível atualizar agora. Os compromissos mostrados podem estar desatualizados.':'Conectado'+(feed.account?' como '+feed.account:'')+(feed.syncedAt?' · atualizado '+timeAgo(feed.syncedAt,now):'');
  return <div className="setting-row calendar-account" key={p}><span className="icon-tile"><CalendarDays size={20}/></span><div><h3>{ACCOUNT[p].title}</h3><p>{line}</p><small>{ACCOUNT[p].hint} Só leitura: nada muda na sua agenda.</small></div><div className="setting-actions">{!feed?<button className="button outline small" disabled={!!busy} onClick={()=>connect(p)}>{busy===p?'Conectando…':'Conectar'}</button>:<>{feed.status==='reconnect'?<button className="button primary small" disabled={!!busy} onClick={()=>connect(p)}>Reconectar</button>:<button className="button outline small" disabled={!!busy} onClick={()=>refresh(p)}><RefreshCw size={14}/>{busy===p?'Atualizando…':'Atualizar agora'}</button>}<button className="button ghost small" disabled={!!busy} onClick={()=>setLeaving(p)}>Desconectar</button></>}</div></div>;})}
 <p className="quiet-copy">Para revogar o acesso de vez, use as configurações de segurança da sua conta Google ou Microsoft.</p>
 {leaving&&<Modal title={'Desconectar '+ACCOUNT[leaving].title+'?'} subtitle={'Os compromissos do '+ACCOUNT[leaving].name+' saem da sua agenda do GeoAI.'} onClose={()=>!busy&&setLeaving(null)}><p className="modal-copy">Nada muda na sua agenda do {ACCOUNT[leaving].name}. Você pode conectar de novo quando quiser.</p><div className="modal-footer"><button className="button ghost" onClick={()=>setLeaving(null)}>Cancelar</button><button className="button destructive" disabled={!!busy} onClick={()=>disconnect(leaving)}>Desconectar</button></div></Modal>}</>;}
```

- [ ] **Step 4: Estilos**

Acrescentar ao fim de `app/globals.css`:

```css
.calendar-account{flex-wrap:wrap}
.setting-row>.setting-actions{flex:0 0 auto;display:flex;gap:8px;flex-wrap:wrap}
```

- [ ] **Step 5: Verificar**

Run: `npm run typecheck` — Expected: sem erros.
Run: `npx eslint components/norte/settings.tsx` — Expected: no máximo 5 erros (linha de base); nenhum erro em linhas novas (avisos de `react-hooks/exhaustive-deps` no efeito de volta da autorização são aceitos: ele roda uma vez por montagem de propósito).
Run: `npm run build` — Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/norte/settings.tsx app/globals.css
git commit -m "Conectar Outlook / Teams e Google Agenda em Configurações"
```

---

### Task 8: Documentação e verificação final

**Files:**
- Create: `docs/agenda-integracao.md`
- Modify: `README.md` (seções "O que funciona" e "Integrações e limites")
- Modify: `.env.example` (comentário)

**Interfaces:**
- Consumes: tudo das tarefas anteriores.
- Produces: guia de configuração para o proprietário.

- [ ] **Step 1: Guia de configuração**

Criar `docs/agenda-integracao.md`:

```markdown
# Conectar Outlook / Teams e Google Agenda

O GeoAI lê (sem alterar) a agenda principal de cada conta conectada. Quem faz a autorização e guarda os tokens é o Clerk; o GeoAI pede o token ao Clerk na hora de sincronizar. Para isso, o Clerk precisa de um app seu no Google e outro na Microsoft. Faça uma vez, na instância do Clerk usada pelo domínio de produção (hoje, a instância de desenvolvimento, com chaves `pk_test`).

## 1. Google

1. Abra o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto (por exemplo, "GeoAI").
2. Em **APIs e serviços › Biblioteca**, procure **Google Calendar API** e clique em **Ativar**.
3. Em **Google Auth Platform** (antiga "Tela de consentimento OAuth"):
   - **Branding**: nome do app "GeoAI", e-mail de suporte e e-mail do desenvolvedor.
   - **Público-alvo**: tipo **Externo**. Clique em **Publicar app** para ficar **Em produção**. Não peça verificação agora. Em "Teste", o Google derruba o acesso a cada 7 dias e a sincronização para.
   - **Acesso a dados**: **Adicionar ou remover escopos** e marque `.../auth/calendar.events.readonly`.
4. No painel do Clerk, abra **Configure › SSO connections › Google** (ou **Add connection › For all users › Google**), ligue **Use custom credentials** e copie a **Authorized Redirect URI**.
5. De volta ao Google, em **Clientes › Criar cliente**, escolha **Aplicativo da Web**, cole a URI do passo anterior em **URIs de redirecionamento autorizados** e crie. Copie o **ID do cliente** e a **Chave secreta**.
6. No Clerk, cole o ID e a chave e, em **Scopes**, acrescente `https://www.googleapis.com/auth/calendar.events.readonly`. Salve.

Na hora de conectar, o Google mostra "O Google não verificou este app". Para seguir: **Avançado › Acessar GeoAI (não seguro)**. Esse aviso some quando o app for verificado pelo Google (necessário antes de abrir para o público; limite de 100 usuários até lá).

## 2. Microsoft (Outlook e Teams)

1. Abra o [portal do Azure](https://portal.azure.com/) › **Microsoft Entra ID › Registros de aplicativo › Novo registro**.
2. Nome "GeoAI"; em **Tipos de conta com suporte**, escolha **Contas em qualquer diretório organizacional e contas pessoais da Microsoft**.
3. No Clerk, abra **Configure › SSO connections › Microsoft**, ligue **Use custom credentials** e copie a **Authorized Redirect URI**. No Azure, em **URI de redirecionamento**, escolha **Web** e cole. Clique em **Registrar**.
4. Na **Visão geral** do app, copie o **ID do aplicativo (cliente)**.
5. Em **Certificados e segredos › Novo segredo do cliente**, crie um segredo (validade de até 24 meses) e copie o **Valor**. Anote a data em que ele expira: depois disso, a conexão para até você criar outro e trocar no Clerk.
6. Em **Permissões de API › Adicionar uma permissão › Microsoft Graph › Permissões delegadas**, marque `Calendars.Read`, `offline_access`, `User.Read`, `openid`, `email` e `profile`.
7. No Clerk, cole o ID e o valor do segredo e, em **Scopes**, acrescente `Calendars.Read` e `offline_access`. Salve.

### Conta da empresa

Se ao conectar aparecer "Precisa de aprovação do administrador", a empresa bloqueia apps externos. O administrador do Microsoft 365 pode aprovar o GeoAI para todos em `https://login.microsoftonline.com/<id-do-locatário>/adminconsent?client_id=<id-do-aplicativo>`.

## 3. Login com Google ou Microsoft

Ativar as conexões no Clerk também mostra "Continuar com Google/Microsoft" na tela de entrada. Se não quiser isso, confira no Clerk se a opção de usar a conexão para entrar e cadastrar pode ser desligada; a conexão da agenda funciona dos dois jeitos.

## 4. Conferir

1. Em produção, abra **Configurações › Calendário & lembretes** e clique em **Conectar** no Outlook / Teams e no Google Agenda.
2. Veja os compromissos na **Agenda** e no painel **Seu dia**. Clique numa reunião do Teams e use **Entrar na reunião**.
3. A sincronização roda sozinha ao abrir o app (se passou de 10 minutos), pelo botão **Atualizar agora** e todo dia às 6h pelo cron `/api/cron/calendar-sync`.
```

- [ ] **Step 2: README**

Em `README.md`:
- Na lista "O que funciona", trocar `- Perfil e fuso horário, temas claro/escuro, backup JSON validado e calendário ICS para importar/exportar eventos.` por `- Perfil e fuso horário, temas claro/escuro, backup JSON validado, calendário ICS para importar/exportar eventos e agenda sincronizada (só leitura) com Outlook/Teams e Google Agenda.`
- Em "Integrações e limites", trocar `- Calendário: importação/exportação ICS; não inclui sincronização OAuth contínua com Google Calendar.` por:

```markdown
- Calendário: importação/exportação ICS e sincronização só leitura com Outlook/Teams (Microsoft 365 ou conta pessoal) e Google Agenda, conectados em Configurações. O OAuth e os tokens ficam com o Clerk, que precisa de credenciais próprias do Google e da Microsoft (passo a passo em `docs/agenda-integracao.md`). Lê só a agenda principal, de 30 dias atrás a 90 à frente; atualiza ao abrir o app, pelo botão "Atualizar agora" e uma vez por dia pelo cron `/api/cron/calendar-sync` (usa o mesmo `CRON_SECRET` do lembrete da Testosterona).
```

- [ ] **Step 3: `.env.example`**

Depois do bloco do Clerk (`CLERK_SECRET_KEY=`), acrescentar:

```
# Agenda do Outlook/Teams e do Google: sem variável nova. As credenciais OAuth vão no painel do Clerk (docs/agenda-integracao.md).
```

- [ ] **Step 4: Verificação final**

Run: `npm test` — Expected: `ℹ pass 105`, `ℹ fail 0`.
Run: `npm run typecheck` — Expected: sem erros.
Run: `npx eslint lib/external-calendar.ts lib/calendar-providers.ts lib/calendar-sync.ts lib/calendar-server.ts app/api/calendar/route.ts app/api/cron/calendar-sync/route.ts lib/agent.ts lib/agent-runtime.ts app/api/assistant/route.ts app/api/telegram/route.ts app/api/state/route.ts db/schema.ts` — Expected: sem erros.
Run: `npx eslint components/norte/settings.tsx components/norte/planning.tsx components/norte/NorteApp.tsx components/norte/context.tsx` — Expected: erros ≤ 5, 2, 13 e 2.
Run: `npm run build` — Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add docs/agenda-integracao.md README.md .env.example
git commit -m "Documenta a conexão com Outlook/Teams e Google Agenda"
```

---

## Depois do plano (fora das tarefas, com o proprietário)

- O proprietário faz a configuração de `docs/agenda-integracao.md`.
- Push do branch e Pull Request; o deploy roda `npm run db:migrate` e cria `calendar_feeds`.
- Teste em produção (as prévias da Vercel ficam atrás de login): conectar as duas contas, conferir Agenda e painel inicial, abrir uma reunião do Teams, cancelar um evento na origem e usar **Atualizar agora**, perguntar ao assistente "o que tenho hoje?", desconectar.

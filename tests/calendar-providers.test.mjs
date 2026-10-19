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
test('401 e 403 pedem para reconectar; 429, 5xx e rede são erro temporário',async t=>{const log=t.mock.method(console,'error',()=>{});
 for(const [status,kind] of [[401,'reconnect'],[403,'reconnect'],[429,'error'],[500,'error']])await assert.rejects(fetchGoogle(fakeFetch([status]),'tok',FROM,TO),e=>e instanceof ProviderError&&e.kind===kind);
 await assert.rejects(fetchMicrosoft(fakeFetch([new Error('rede')]),'tok',FROM,TO),e=>e instanceof ProviderError&&e.kind==='error'&&e.message==='Não foi possível atualizar agora.');
 await assert.rejects(fetchMicrosoft(fakeFetch([401]),'tok',FROM,TO),e=>e.message==='Precisa reconectar.');
 assert.deepEqual(log.mock.calls.map(c=>c.arguments.slice(0,3)),[['calendar provider','www.googleapis.com',401],['calendar provider','www.googleapis.com',403],['calendar provider','www.googleapis.com',429],['calendar provider','www.googleapis.com',500],['calendar provider','graph.microsoft.com','Error'],['calendar provider','graph.microsoft.com',401]]);});
test('falha do provedor deixa uma linha no log do servidor, com trecho da resposta e sem o token',async t=>{const log=t.mock.method(console,'error',()=>{});
 await assert.rejects(fetchGoogle(async()=>new Response('{"error":\n"'+'x'.repeat(300)+'"}',{status:500}),'tok',FROM,TO),e=>e.kind==='error');
 assert.equal(log.mock.callCount(),1);const [label,host,status,excerpt]=log.mock.calls[0].arguments;
 assert.deepEqual([label,host,status],['calendar provider','www.googleapis.com',500]);assert.equal(excerpt.length,200);assert.ok(excerpt.startsWith('{"error": "xxx'));
 await assert.rejects(fetchMicrosoft(async()=>{throw new DOMException('Tempo esgotado','TimeoutError');},'tok',FROM,TO),e=>e.kind==='error');
 assert.equal(log.mock.callCount(),2);assert.deepEqual(log.mock.calls[1].arguments,['calendar provider','graph.microsoft.com','TimeoutError']);
 for(const c of log.mock.calls)assert.equal(JSON.stringify(c.arguments).includes('tok'),false);});
test('para em 1000 eventos',async()=>{
 const many=n=>Array.from({length:n},(_,i)=>google('e'+n+'-'+i));
 const f=fakeFetch([{items:many(600),nextPageToken:'p2'},{items:many(700),nextPageToken:'p3'},{items:many(10)}]);
 const events=await fetchGoogle(f,'tok',FROM,TO);assert.equal(events.length,MAX_EVENTS);assert.equal(f.calls.length,2);});

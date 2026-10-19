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

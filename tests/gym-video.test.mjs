import {test} from 'node:test';
import assert from 'node:assert/strict';
import {videoQuery,searchUrl,embedUrl,parseSearch,searchRequest,videosFor,memoryVideoCache,isFresh,VIDEO_MAX} from '../lib/gym-video.ts';
import {exerciseOf,fromCustom} from '../lib/gym-catalog.ts';

const BENCH=exerciseOf('Barbell_Bench_Press_-_Medium_Grip');
const NOW=new Date('2026-11-03T12:00:00Z');
const item=(id,title='Supino &amp; dicas',channel='Canal &quot;X&quot;')=>({id:{videoId:id},snippet:{title,channelTitle:channel}});
const api=(items,status=200)=>{const calls=[];return {calls,fetch:async url=>{calls.push(url);return {ok:status===200,status,json:async()=>({items})};}};};
const deps=(over={})=>({cache:memoryVideoCache(),key:'k',now:()=>NOW,quota:async()=>true,...api([item('abcdefghijk'),item('bcdefghijkl')]),...over});

test('busca em pt-BR com o nome do exercício; vídeos curtos, incorporáveis e com busca segura',()=>{
 assert.equal(videoQuery(BENCH),'Supino reto com barra como fazer execução correta');assert.match(videoQuery(exerciseOf('90_90_Hamstring')),/alongamento/);
 const u=new URL(searchRequest(BENCH,'chave'));for(const [k,v] of [['videoDuration','short'],['videoEmbeddable','true'],['safeSearch','strict'],['relevanceLanguage','pt'],['regionCode','BR'],['type','video'],['key','chave']])assert.equal(u.searchParams.get(k),v,k);
 assert.ok(searchUrl(BENCH).startsWith('https://www.youtube.com/results?search_query=Supino'));assert.ok(embedUrl('abcdefghijk').startsWith('https://www.youtube-nocookie.com/embed/abcdefghijk?'));});

test('resposta do YouTube: ids válidos, sem repetir, entidades decodificadas e no máximo 5',()=>{
 const v=parseSearch({items:[item('abcdefghijk'),item('abcdefghijk'),item('bad'),{id:{}},...Array.from({length:8},(_,i)=>item('vid'+String(i).padStart(8,'0')))]});
 assert.equal(v.length,VIDEO_MAX);assert.equal(v[0].title,'Supino & dicas');assert.equal(v[0].channel,'Canal "X"');assert.deepEqual(parseSearch(null),[]);});

test('cache primeiro: a segunda vez não chama o YouTube nem gasta cota; cache velho é renovado',async()=>{
 let quota=0;const d=deps({quota:async()=>{quota++;return true;}});
 const a=await videosFor(d,BENCH);assert.equal(a.source,'youtube');assert.equal(a.videos.length,2);
 const b=await videosFor(d,BENCH);assert.equal(b.source,'cache');assert.equal(d.calls.length,1);assert.equal(quota,1);
 assert.equal(isFresh('2026-09-01T00:00:00Z',NOW),false);await d.cache.put(BENCH.id,a.videos,'2026-08-01T00:00:00Z');await videosFor(d,BENCH);assert.equal(d.calls.length,2,'vencido busca de novo');});

test('sem chave, sem cota, erro ou exercício próprio: devolve o link de busca (ou o cache antigo)',async()=>{
 assert.equal((await videosFor(deps({key:undefined}),BENCH)).reason,'no-key');
 assert.equal((await videosFor(deps({quota:async()=>false}),BENCH)).reason,'quota');
 assert.equal((await videosFor(deps(api([],403)),BENCH)).reason,'quota');
 assert.equal((await videosFor(deps(api([],500)),BENCH)).reason,'error');
 assert.equal((await videosFor(deps(api([])),BENCH)).reason,'empty');
 const custom=deps();const r=await videosFor(custom,fromCustom({id:'c-1',name:'Meu aparelho',equipment:'machine',primary:['lats'],secondary:[],category:'strength',timed:false}));assert.equal(r.reason,'custom');assert.equal(custom.calls.length,0,'nome de exercício próprio não sai do app');
 const old=deps(api([],500));await old.cache.put(BENCH.id,[{id:'abcdefghijk',title:'t',channel:'c'}],'2026-01-01T00:00:00Z');const s=await videosFor(old,BENCH);assert.equal(s.source,'cache');assert.equal(s.videos.length,1,'falha usa o cache antigo');
 const thrown=deps({fetch:async()=>{throw new Error('rede');}});assert.equal((await videosFor(thrown,BENCH)).reason,'error');});

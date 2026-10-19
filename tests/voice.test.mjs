import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voiceProviders,firstWorking,hearVoice,heardLine,MAX_VOICE_BYTES,VOICE_TOO_LONG,VOICE_LIMIT,VOICE_UNCLEAR,VOICE_FAILED} from '../lib/voice.ts';

const AUDIO=new Uint8Array([79,103,103,83,1,2,3]);
function harness({quota=true,download=async()=>AUDIO,transcript='  Marca dentista amanhã às 15h  '}={}){const log=[];
 const deps={quota:async()=>{log.push('quota');return quota;},download:async()=>{log.push('download');return download();},transcribe:async audio=>{log.push('transcribe');deps.heard=audio;if(transcript instanceof Error)throw transcript;return transcript;}};
 return {deps,log};}

test('provedores: Groq primeiro e a OpenAI da chave do assistente como reserva',()=>{
 assert.deepEqual(voiceProviders({GROQ_API_KEY:' g ',AI_API_KEY:'o',AI_MODEL:'gpt-6-luna'}),[{name:'groq',apiKey:'g',model:'whisper-large-v3-turbo'},{name:'openai',apiKey:'o',model:'gpt-4o-mini-transcribe'}]);
 assert.deepEqual(voiceProviders({AI_API_KEY:'o'}),[{name:'openai',apiKey:'o',model:'gpt-4o-mini-transcribe'}]);
 assert.deepEqual(voiceProviders({GROQ_API_KEY:'g'}),[{name:'groq',apiKey:'g',model:'whisper-large-v3-turbo'}]);});
test('provedores: endpoint compatível em AI_BASE_URL não recebe áudio e chaves vazias não contam',()=>{
 assert.deepEqual(voiceProviders({AI_API_KEY:'o',AI_BASE_URL:'https://openrouter.ai/api/v1'}),[]);
 assert.deepEqual(voiceProviders({GROQ_API_KEY:'  ',AI_API_KEY:''}),[]);
 assert.deepEqual(voiceProviders({}),[]);});

test('reserva: se o primeiro provedor falha, o seguinte responde',async()=>{const order=[];
 const r=await firstWorking([async()=>{order.push('groq');throw new Error('429');},async()=>{order.push('openai');return 'oi';}]);
 assert.equal(r,'oi');assert.deepEqual(order,['groq','openai']);});
test('reserva: o primeiro que responde encerra a busca; sem nenhum, o último erro sobe',async()=>{const order=[];
 assert.equal(await firstWorking([async()=>{order.push('groq');return 'a';},async()=>{order.push('openai');return 'b';}]),'a');assert.deepEqual(order,['groq']);
 await assert.rejects(firstWorking([async()=>{throw new Error('um');},async()=>{throw new Error('dois');}]),/dois/);
 await assert.rejects(firstWorking([]));});

test('áudio vira o texto transcrito, sem espaços nas pontas',async()=>{const {deps,log}=harness();
 assert.deepEqual(await hearVoice(deps,7),{text:'Marca dentista amanhã às 15h'});
 assert.deepEqual(log,['quota','download','transcribe']);assert.equal(deps.heard,AUDIO);});
test('áudio de mais de 2 minutos é recusado antes da cota e do download; duração desconhecida segue',async()=>{
 const long=harness();assert.deepEqual(await hearVoice(long.deps,121),{reply:VOICE_TOO_LONG});assert.deepEqual(long.log,[]);
 assert.deepEqual(await hearVoice(harness().deps,120),{text:'Marca dentista amanhã às 15h'});
 assert.deepEqual(await hearVoice(harness().deps,undefined),{text:'Marca dentista amanhã às 15h'});});
test('arquivo grande demais não vai para a transcrição',async()=>{const {deps,log}=harness({download:async()=>new Uint8Array(MAX_VOICE_BYTES+1)});
 assert.deepEqual(await hearVoice(deps,30),{reply:VOICE_TOO_LONG});assert.deepEqual(log,['quota','download']);});
test('cota do dia esgotada: não baixa nem transcreve',async()=>{const {deps,log}=harness({quota:false});
 assert.deepEqual(await hearVoice(deps,10),{reply:VOICE_LIMIT});assert.deepEqual(log,['quota']);});
test('falha ao baixar ou ao transcrever vira aviso, sem erro para o canal',async()=>{
 assert.deepEqual(await hearVoice(harness({download:async()=>{throw new Error('Evolution respondeu 500');}}).deps,10),{reply:VOICE_FAILED});
 assert.deepEqual(await hearVoice(harness({transcript:new Error('timeout')}).deps,10),{reply:VOICE_FAILED});});
test('áudio sem fala pede para repetir',async()=>{
 assert.deepEqual(await hearVoice(harness({transcript:'   '}).deps,3),{reply:VOICE_UNCLEAR});
 assert.deepEqual(await hearVoice(harness({transcript:''}).deps,3),{reply:VOICE_UNCLEAR});});

test('a resposta mostra o que foi ouvido; transcrição longa aparece cortada',()=>{
 assert.equal(heardLine('Gastei 40 no almoço'),'🎙️ “Gastei 40 no almoço”');
 const long='a'.repeat(600);assert.equal(heardLine(long),'🎙️ “'+'a'.repeat(500)+'…”');});

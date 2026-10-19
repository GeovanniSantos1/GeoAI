import {transcribe} from 'ai';import {createGroq} from '@ai-sdk/groq';import {createOpenAI} from '@ai-sdk/openai';import {voiceProviders,firstWorking,hearVoice,type VoiceProvider} from './voice';import {consumeQuota} from './quota';import {todayInZone} from './core';
// Liga o passo comum do áudio à cota do banco e aos provedores configurados: Groq e, de reserva, a OpenAI. A transcrição da OpenAI não guarda o áudio.
const model=(p:VoiceProvider)=>p.name==='groq'?createGroq({apiKey:p.apiKey}).transcription(p.model):createOpenAI({apiKey:p.apiKey}).transcription(p.model);
export const voiceReady=()=>voiceProviders(process.env).length>0;
const transcribeAudio=(audio:Uint8Array)=>firstWorking(voiceProviders(process.env).map(p=>async()=>{
 try{return (await transcribe({model:model(p),audio,providerOptions:{[p.name]:{language:'pt'}},maxRetries:0,abortSignal:AbortSignal.timeout(20000)})).text;}
 catch(e){console.error('voice '+p.name,e instanceof Error?e.message:'erro');throw e;}}));
export const hear=(userId:string,seconds:number|undefined,download:()=>Promise<Uint8Array>)=>hearVoice({quota:()=>consumeQuota(userId,'voice',todayInZone()),download,transcribe:transcribeAudio},seconds);

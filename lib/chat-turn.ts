import {generateText,isStepCount,type ModelMessage} from 'ai';import {planFromText,todayInZone} from './core';import type {Proposal} from './types';import {agentModel,agentInstructions,agentTools,AI_UNAVAILABLE,GUIDED_REPLY,GUIDED_EMPTY} from './agent-runtime';import {loadWorkspace} from './workspace-server';import {loadExternal,EXTERNAL_FOR_AGENT} from './calendar-sync';import {calendarDeps} from './calendar-server';import type {HistoryEntry} from './telegram';
// Rodada do assistente comum ao Telegram e ao WhatsApp: modo guiado sem IA; com IA, o mesmo modelo, ferramentas e agenda externa.
export async function agentTurn(userId:string,history:HistoryEntry[],text:string,channel:'telegram'|'whatsapp'):Promise<{reply:string;items:Proposal[]}|{error:string}>{
 const {state}=await loadWorkspace(userId,'');const today=todayInZone(state.profile.timezone),model=agentModel(),proposals:Proposal[]=[];
 if(!model){try{proposals.push(...planFromText(text,today));}catch{}return {reply:proposals.length?GUIDED_REPLY:GUIDED_EMPTY,items:proposals.slice(0,15)};}
 try{const external=await loadExternal(calendarDeps(),userId,EXTERNAL_FOR_AGENT);const messages=[...history.map(h=>({role:h.role,content:h.text})),{role:'user',content:text}] as ModelMessage[];
  const result=await generateText({model,instructions:agentInstructions(state,today,channel),messages,tools:agentTools(state,today,items=>proposals.push(...items),external),stopWhen:isStepCount(6),maxOutputTokens:1500,abortSignal:AbortSignal.timeout(45000)});
  return {reply:result.text.trim()||'Pronto.',items:proposals.slice(0,15)};}
 catch(err){console.error(channel+' agent',err);return {error:AI_UNAVAILABLE};}}

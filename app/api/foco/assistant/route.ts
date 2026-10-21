import {createUIMessageStream,createUIMessageStreamResponse,isStepCount,streamText,toUIMessageStream,type ModelMessage} from 'ai';
import {boardDeps,boardUser,readBody,boardFail} from '@/lib/board-deps';import {agentModel,AI_UNAVAILABLE} from '@/lib/agent-runtime';import {jsonError} from '@/lib/workspace-server';import {todayInZone} from '@/lib/core';
import {focoHistory,focoContext,focoInstructions,focusing,FOCO_NO_AI} from '@/lib/foco-agent';import {focoTools} from '@/lib/foco-tools';import type {Workspace} from '@/lib/types';
export const maxDuration=60;
export async function GET(){return Response.json({mode:agentModel()?'ai':'guided'});}
export async function POST(request:Request){const g=await boardUser(request);if('error' in g)return g.error;const model=agentModel();if(!model)return jsonError(FOCO_NO_AI,503);
 const d=boardDeps(g.userId);let messages:ModelMessage[],state:Workspace;
 try{const body=await readBody(request,200000);({state}=await d.load());const now=new Date();
  messages=focoHistory(body.messages,body.decisions,focoContext(state,await d.store.cards(g.userId),todayInZone(state.profile.timezone,now),now,body.openCardId));}catch(e){return boardFail(e);}
 const quiet=focusing(state,new Date());
 const stream=createUIMessageStream({execute:async({writer})=>{
  const result=streamText({model,instructions:focoInstructions(state.profile.assistantName||'GeoAI',quiet),messages,tools:focoTools(d),stopWhen:isStepCount(8),maxOutputTokens:1500,abortSignal:AbortSignal.timeout(60000)});
  writer.merge(toUIMessageStream({stream:result.stream,onError:error=>{console.error('foco assistant',error);return AI_UNAVAILABLE;}}));}});
 return createUIMessageStreamResponse({stream});}

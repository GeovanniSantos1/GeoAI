import {convertToModelMessages,createUIMessageStream,createUIMessageStreamResponse,isStepCount,streamText,toUIMessageStream} from 'ai';import {getUserId} from '@/lib/auth';import {planFromText,todayInZone} from '@/lib/core';import type {Workspace} from '@/lib/types';import {proposalsText,cleanHistory,type AgentMessage} from '@/lib/agent';import {agentModel,agentInstructions,agentTools,AI_UNAVAILABLE,GUIDED_REPLY,GUIDED_EMPTY} from '@/lib/agent-runtime';import {loadWorkspace,jsonError,sameOrigin} from '@/lib/workspace-server';
export const maxDuration=60;
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 let history:AgentMessage[];try{const text=await request.text();if(text.length>200000)return jsonError('Conversa muito longa',413);history=cleanHistory(JSON.parse(text).messages);}catch(e){return jsonError(e instanceof Error&&!(e instanceof SyntaxError)?e.message:'Pedido inválido');}
 let state:Workspace;try{state=(await loadWorkspace(userId,'')).state;}catch{return jsonError('Não foi possível abrir seu espaço',500);}const today=todayInZone(state.profile.timezone);
 const model=agentModel();
 if(!model){const last=history.at(-1)!.parts.map(p=>p.type==='text'?p.text:'').join('\n');
  const stream=createUIMessageStream<AgentMessage>({execute:({writer})=>{let items:ReturnType<typeof planFromText>=[];try{items=planFromText(last,today);}catch{}const id=crypto.randomUUID();
   writer.write({type:'start'});writer.write({type:'text-start',id});writer.write({type:'text-delta',id,delta:items.length?GUIDED_REPLY:GUIDED_EMPTY});writer.write({type:'text-end',id});
   if(items.length)writer.write({type:'data-proposals',data:{items}});writer.write({type:'finish'});}});
  return createUIMessageStreamResponse({stream});}
 const stream=createUIMessageStream<AgentMessage>({execute:async({writer})=>{
  const result=streamText({model,instructions:agentInstructions(state,today,'app'),
   messages:await convertToModelMessages<AgentMessage>(history,{convertDataPart:p=>p.type==='data-proposals'?{type:'text',text:proposalsText(p.data.items)}:undefined}),
   stopWhen:isStepCount(6),maxOutputTokens:1500,abortSignal:AbortSignal.timeout(60000),
   tools:agentTools(state,today,items=>writer.write({type:'data-proposals',data:{items}}))});
  writer.merge(toUIMessageStream({stream:result.stream,onError:error=>{console.error('assistant',error);return AI_UNAVAILABLE;}}));
 }});
 return createUIMessageStreamResponse({stream});}
export async function GET(){return Response.json({mode:agentModel()?'ai':'guided'});}

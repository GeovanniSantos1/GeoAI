import {generateText,isStepCount,type ModelMessage} from 'ai';import {planFromText,todayInZone} from '@/lib/core';import type {Proposal} from '@/lib/types';import {proposalsText} from '@/lib/agent';import {config,agentModel,agentInstructions,agentTools,AI_UNAVAILABLE,GUIDED_REPLY,GUIDED_EMPTY} from '@/lib/agent-runtime';import {loadExternal,EXTERNAL_FOR_AGENT} from '@/lib/calendar-sync';import {calendarDeps} from '@/lib/calendar-server';import {parseUpdate,command,webhookSecret,chunkText,proposalList,pushHistory,addPending,newCode,telegramApi,type TelegramEvent} from '@/lib/telegram';import {consumeCode,linkChat,getLinkByChat,unlinkChat,claimUpdate,saveConversation} from '@/lib/telegram-store';import {loadWorkspace,mutateWorkspace} from '@/lib/workspace-server';import {parseTrtCallback,trtCallbackAction} from '@/lib/trt-reminders';
// Webhook público do bot. Só aceita chamadas com o segredo registrado no setWebhook e só responde a chats vinculados a uma conta.
type Api=ReturnType<typeof telegramApi>;
export const maxDuration=60;
const HELP='Me conte o que você quer organizar ou pergunte sobre sua agenda, seus gastos e seus registros. Eu sugiro as ações e você confirma pelos botões.\n\nComandos: /ajuda e /desconectar.';
const NOT_LINKED='Este chat ainda não está ligado a uma conta do GeoAI. No app, abra Configurações, procure GeoAI no Telegram e toque em Conectar Telegram.';
const ok=()=>Response.json({ok:true});
export async function POST(request:Request){const c=config(),token=c.TELEGRAM_BOT_TOKEN;if(!token)return new Response('Not found',{status:404});
 if(request.headers.get('x-telegram-bot-api-secret-token')!==await webhookSecret(token))return new Response('Unauthorized',{status:401});
 let event:TelegramEvent|null;try{event=parseUpdate(await request.json());}catch{return ok();}if(!event)return ok();
 const api=telegramApi(token,c.TELEGRAM_API_BASE||undefined);
 // Sempre 200: um erro aqui faria o Telegram reenviar a mesma mensagem repetidas vezes.
 try{if(event.kind==='message')await onMessage(api,event);else await onCallback(api,event);}catch(e){console.error('telegram',e);}
 return ok();}
async function sendText(api:Api,chatId:string,text:string,extra:Record<string,unknown>={}){const parts=chunkText(text);for(let i=0;i<parts.length;i++)await api('sendMessage',{chat_id:chatId,text:parts[i],...(i===parts.length-1?extra:{})});}
async function onMessage(api:Api,e:Extract<TelegramEvent,{kind:'message'}>){const send=(text:string,extra?:Record<string,unknown>)=>sendText(api,e.chatId,text,extra);
 if(!e.private)return send('Para proteger seus dados, eu só converso em chats privados.');
 const cmd=command(e.text);
 if(cmd?.name==='start'&&cmd.arg){const userId=await consumeCode(cmd.arg);if(!userId)return send('Este link de conexão expirou ou já foi usado. Gere um novo em Configurações no GeoAI.');await linkChat(userId,e.chatId,e.label,e.updateId);return send('Pronto! Este chat está conectado ao seu GeoAI.\n\n'+HELP);}
 const link=await getLinkByChat(e.chatId);if(!link)return send(NOT_LINKED);
 if(!await claimUpdate(e.chatId,e.updateId))return;
 if(cmd?.name==='desconectar'){await unlinkChat(e.chatId);return send('Telegram desconectado do GeoAI. Para conectar de novo, use Configurações no app.');}
 if(cmd&&['start','ajuda','help'].includes(cmd.name))return send(HELP);
 if(!e.text.trim())return send('Por enquanto eu entendo só mensagens de texto.');
 await api('sendChatAction',{chat_id:e.chatId,action:'typing'}).catch(()=>{});
 const {state}=await loadWorkspace(link.userId,'');const today=todayInZone(state.profile.timezone),model=agentModel(),proposals:Proposal[]=[];let reply:string;
 if(!model){try{proposals.push(...planFromText(e.text,today));}catch{}reply=proposals.length?GUIDED_REPLY:GUIDED_EMPTY;}
 else{try{const external=await loadExternal(calendarDeps(),link.userId,EXTERNAL_FOR_AGENT);const messages=[...link.history.map(h=>({role:h.role,content:h.text})),{role:'user',content:e.text}] as ModelMessage[];
  const result=await generateText({model,instructions:agentInstructions(state,today,'telegram'),messages,tools:agentTools(state,today,items=>proposals.push(...items),external),stopWhen:isStepCount(6),maxOutputTokens:1500,abortSignal:AbortSignal.timeout(45000)});reply=result.text.trim()||'Pronto.';}
  catch(err){console.error('telegram agent',err);return send(AI_UNAVAILABLE);}}
 const items=proposals.slice(0,15);let pending=link.pending;
 if(items.length){const id=newCode().slice(0,10);pending=addPending(pending,id,items);await send(reply+'\n\n'+proposalList(items),{reply_markup:{inline_keyboard:[[{text:'✅ Adicionar '+(items.length===1?'1 item':items.length+' itens'),callback_data:'add:'+id},{text:'Descartar',callback_data:'drop:'+id}]]}});}
 else await send(reply);
 await saveConversation(e.chatId,pushHistory(link.history,[{role:'user',text:e.text},{role:'assistant',text:reply+(items.length?'\n\n'+proposalsText(items):'')}]),pending);}
async function onCallback(api:Api,e:Extract<TelegramEvent,{kind:'callback'}>){const answer=(text:string)=>api('answerCallbackQuery',{callback_query_id:e.callbackId,text}).catch(()=>{});
 const link=await getLinkByChat(e.chatId);if(!link)return answer('Este chat não está conectado ao GeoAI.');
 if(!await claimUpdate(e.chatId,e.updateId))return answer('');
 const clearButtons=()=>api('editMessageReplyMarkup',{chat_id:e.chatId,message_id:e.messageId,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
 const trt=parseTrtCallback(e.data);
 if(trt){const {state}=await loadWorkspace(link.userId,'');const r=trtCallbackAction(state,todayInZone(state.profile.timezone),trt);
  if(r.command){try{await mutateWorkspace(link.userId,'',r.command);}catch(err){console.error('telegram trt',err);return answer('Não foi possível salvar agora. Tente de novo.');}}
  await clearButtons();await answer(r.command?(trt.action==='done'?'Registrado!':'Adiado.'):'Ok');return sendText(api,e.chatId,r.reply);}
 const [action,id]=e.data.split(':'),group=id?link.pending[id]:undefined;
 if(!group||!['add','drop'].includes(action)){await clearButtons();return answer('Essas sugestões não estão mais disponíveis.');}
 if(action==='add'){try{await mutateWorkspace(link.userId,'',{type:'confirmPlan',items:group.items});}catch(err){console.error('telegram confirm',err);return answer('Não foi possível salvar agora. Tente de novo.');}}
 await clearButtons();
 const pending={...link.pending};delete pending[id];const n=group.items.length;
 const note=action==='add'?'✅ '+(n===1?'1 item adicionado':n+' itens adicionados')+' ao seu GeoAI.':'Sugestões descartadas.';
 await saveConversation(e.chatId,pushHistory(link.history,[{role:'assistant',text:note}]),pending);
 await answer(action==='add'?'Adicionado!':'Descartado.');await sendText(api,e.chatId,note);}

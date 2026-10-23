import {proposalsText} from '@/lib/agent';import {config} from '@/lib/agent-runtime';import {parseUpdate,command,webhookSecret,chunkText,proposalList,pushHistory,addPending,newCode,telegramApi,telegramFile,type TelegramEvent} from '@/lib/telegram';import {consumeCode,linkChat,getLinkByChat,unlinkChat,claimUpdate,saveConversation} from '@/lib/telegram-store';import {loadWorkspace,mutateWorkspace} from '@/lib/workspace-server';import {parseWater} from '@/lib/hydration';import {waterChat} from '@/lib/water-channels';import {agentTurn} from '@/lib/chat-turn';import {resolveChoice} from '@/lib/chat-actions';import {voiceReady,hear} from '@/lib/voice-server';import {heardLine,mediaReply} from '@/lib/voice';import {confirmCommand} from '@/lib/board-deps';
// Webhook público do bot. Só aceita chamadas com o segredo registrado no setWebhook e só responde a chats vinculados a uma conta.
type Api=ReturnType<typeof telegramApi>;
// Áudio soma o download e a transcrição à rodada da IA (até 45 s).
export const maxDuration=120;
const HELP='Me conte o que você quer organizar ou pergunte sobre sua agenda, seus gastos e seus registros. Eu sugiro as ações e você confirma pelos botões.\n\nÁgua: mande "bebi 500 ml" ou "2 copos" e eu somo na hora; "água?" mostra o seu dia.\n\nComandos: /ajuda e /desconectar.';
const NOT_LINKED='Este chat ainda não está ligado a uma conta do GeoAI. No app, abra Configurações, procure GeoAI no Telegram e toque em Conectar Telegram.';
const ok=()=>Response.json({ok:true});
export async function POST(request:Request){const c=config(),token=c.TELEGRAM_BOT_TOKEN;if(!token)return new Response('Not found',{status:404});
 if(request.headers.get('x-telegram-bot-api-secret-token')!==await webhookSecret(token))return new Response('Unauthorized',{status:401});
 let event:TelegramEvent|null;try{event=parseUpdate(await request.json());}catch{return ok();}if(!event)return ok();
 const api=telegramApi(token,c.TELEGRAM_API_BASE||undefined);
 // Sempre 200: um erro aqui faria o Telegram reenviar a mesma mensagem repetidas vezes.
 try{if(event.kind==='message')await onMessage(api,event,fileId=>telegramFile(token,fileId,c.TELEGRAM_API_BASE||undefined));else await onCallback(api,event);}catch(e){console.error('telegram',e);}
 return ok();}
async function sendText(api:Api,chatId:string,text:string,extra:Record<string,unknown>={}){const parts=chunkText(text);for(let i=0;i<parts.length;i++)await api('sendMessage',{chat_id:chatId,text:parts[i],...(i===parts.length-1?extra:{})});}
async function onMessage(api:Api,e:Extract<TelegramEvent,{kind:'message'}>,file:(fileId:string)=>Promise<Uint8Array>){const send=(text:string,extra?:Record<string,unknown>)=>sendText(api,e.chatId,text,extra);
 if(!e.private)return send('Para proteger seus dados, eu só converso em chats privados.');
 const cmd=command(e.text);
 if(cmd?.name==='start'&&cmd.arg){const userId=await consumeCode(cmd.arg);if(!userId)return send('Este link de conexão expirou ou já foi usado. Gere um novo em Configurações no GeoAI.');await linkChat(userId,e.chatId,e.label,e.updateId);return send('Pronto! Este chat está conectado ao seu GeoAI.\n\n'+HELP);}
 const link=await getLinkByChat(e.chatId);if(!link)return send(NOT_LINKED);
 if(!await claimUpdate(e.chatId,e.updateId))return;
 if(cmd?.name==='desconectar'){await unlinkChat(e.chatId);return send('Telegram desconectado do GeoAI. Para conectar de novo, use Configurações no app.');}
 if(cmd&&['start','ajuda','help'].includes(cmd.name))return send(HELP);
 const typing=()=>api('sendChatAction',{chat_id:e.chatId,action:'typing'}).catch(()=>{});
 // Áudio vira texto antes da IA; a resposta começa com o que foi ouvido, e só o texto entra no histórico.
 let text=e.text,heard='';
 if(!text.trim()){const ready=voiceReady(),voice=e.voice;if(!voice||!ready)return send(mediaReply(ready));
  await typing();const h=await hear(link.userId,voice.seconds,()=>file(voice.fileId));if('reply' in h)return send(h.reply);text=h.text;heard=heardLine(text)+'\n\n';}
 // Água ("bebi 500 ml", "água?", "desfazer água"): registra na hora, sem IA e sem botões.
 const water=parseWater(text);
 if(water){const reply=await waterChat({load:u=>loadWorkspace(u,''),mutate:(u,c)=>mutateWorkspace(u,'',c)},link.userId,water,'telegram');await send(heard+reply);return saveConversation(e.chatId,pushHistory(link.history,[{role:'user',text},{role:'assistant',text:reply}]),link.pending);}
 await typing();
 const turn=await agentTurn(link.userId,link.history,text,'telegram');if('error' in turn)return send(heard+turn.error);const {reply}=turn;
 const items=turn.items;let pending=link.pending;
 if(items.length){const id=newCode().slice(0,10);pending=addPending(pending,id,items);await send(heard+reply+'\n\n'+proposalList(items),{reply_markup:{inline_keyboard:[[{text:'✅ Adicionar '+(items.length===1?'1 item':items.length+' itens'),callback_data:'add:'+id},{text:'Descartar',callback_data:'drop:'+id}]]}});}
 else await send(heard+reply);
 await saveConversation(e.chatId,pushHistory(link.history,[{role:'user',text},{role:'assistant',text:reply+(items.length?'\n\n'+proposalsText(items):'')}]),pending);}
async function onCallback(api:Api,e:Extract<TelegramEvent,{kind:'callback'}>){const answer=(text:string)=>api('answerCallbackQuery',{callback_query_id:e.callbackId,text}).catch(()=>{});
 const link=await getLinkByChat(e.chatId);if(!link)return answer('Este chat não está conectado ao GeoAI.');
 if(!await claimUpdate(e.chatId,e.updateId))return answer('');
 const clearButtons=()=>api('editMessageReplyMarkup',{chat_id:e.chatId,message_id:e.messageId,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
 const {state}=await loadWorkspace(link.userId,'');const r=resolveChoice(e.data,state,link.pending);
 if(r.expired){await clearButtons();return answer(r.ack);}
 if(r.command){try{await confirmCommand(link.userId,r.command);}catch(err){console.error('telegram choice',err);return answer('Não foi possível salvar agora. Tente de novo.');}}
 await clearButtons();
 if(r.pending)await saveConversation(e.chatId,pushHistory(link.history,[{role:'assistant',text:r.reply}]),r.pending);
 await answer(r.ack);await sendText(api,e.chatId,r.reply);}

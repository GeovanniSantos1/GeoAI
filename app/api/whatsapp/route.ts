import {after} from 'next/server';import {timingSafeEqual} from 'node:crypto';import {parseEvolutionEvent,linkCodeOf,waCommand,choiceIndex,choicesOf,waSecret,type WaMessage} from '@/lib/whatsapp';import {waContext,ownerJidCached,sayWa,knownUnlinked,rememberUnlinked,forgetUnlinked} from '@/lib/whatsapp-server';import {consumeWaCode,linkWhatsapp,getWaLinkByJid,claimWaMessage,unlinkWaJid,saveWaConversation,swapWaChoices} from '@/lib/whatsapp-store';import {agentTurn} from '@/lib/chat-turn';import {resolveChoice} from '@/lib/chat-actions';import {proposalList,pushHistory,addPending,newCode,type Pending} from '@/lib/telegram';import {proposalsText} from '@/lib/agent';import {loadWorkspace,mutateWorkspace} from '@/lib/workspace-server';import {parseWater} from '@/lib/hydration';import {waterChat} from '@/lib/water-channels';import {voiceReady,hear} from '@/lib/voice-server';import {heardLine,mediaReply} from '@/lib/voice';import {confirmCommand} from '@/lib/board-deps';import {userHasAccess} from '@/lib/billing-server';import {EXPIRED_TEXT} from '@/lib/billing';
// Webhook público da Evolution API. Só aceita o segredo registrado no webhook; responde 200 na hora e processa depois,
// para a Evolution não reenviar por demora. Número pessoal: conversas não ligadas e grupos ficam em silêncio.
export const maxDuration=120;
const HELP='Me conte o que você quer organizar ou pergunte sobre sua agenda, seus gastos e seus registros. Eu sugiro as ações e você confirma respondendo 1 ou 2.\n\nÁgua: mande "bebi 500 ml" ou "2 copos" e eu somo na hora; "água?" mostra o seu dia.\n\nComandos: ajuda e desconectar.';
type Ctx=NonNullable<ReturnType<typeof waContext>>;
const sameSecret=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function POST(request:Request){const ctx=waContext();if(!ctx)return new Response('Not found',{status:404});
 if(!sameSecret(request.headers.get('x-geoai-secret')??'',await waSecret(ctx.config.key)))return new Response('Unauthorized',{status:401});
 let raw:unknown;try{raw=await request.json();}catch{return Response.json({ok:true});}
 // Só a mensagem do dono (fromMe) precisa do número da instância; grupos, listas e contatos não chamam a Evolution.
 after(async()=>{try{let m=parseEvolutionEvent(raw,ctx.config.instance);if(m?.fromMe)m=parseEvolutionEvent(raw,ctx.config.instance,await ownerJidCached(ctx.api,ctx.config.instance));if(m)await onMessage(ctx,m);}catch(e){console.error('whatsapp',e instanceof Error?e.message:'erro');}});
 return Response.json({ok:true});}
async function onMessage(ctx:Ctx,m:WaMessage){const say=(text:string)=>sayWa(ctx.api,m.jid,text);
 const code=linkCodeOf(m.text);
 if(code){const known=await getWaLinkByJid(m.jid);if(known?.recentIds.includes(m.id))return;
  const userId=await consumeWaCode(code);if(!userId)return say('Este código expirou ou já foi usado. Gere um novo em Configurações no GeoAI.');await linkWhatsapp(userId,m.jid,m.label,m.id);forgetUnlinked(ctx.config.instance,m.jid);return say('Pronto! Este WhatsApp está conectado ao seu GeoAI.\n\n'+HELP);}
 if(knownUnlinked(ctx.config.instance,m.jid))return;
 const known=await getWaLinkByJid(m.jid);if(!known){rememberUnlinked(ctx.config.instance,m.jid);return;}
 // O claim devolve a ligação atual: history, pending e choices vêm dela, não da leitura de antes.
 const link=await claimWaMessage(known,m.id);if(!link)return;
 // Acesso vencido: só ajuda e desconectar (digitados); escolhas, áudio e IA ficam de fora.
 {const c=waCommand(m.text);if(c!=='desconectar'&&c!=='ajuda'&&!await userHasAccess(link.userId))return say(EXPIRED_TEXT);}
 const idx=choiceIndex(m.text),choice=idx===null?undefined:choicesOf(link.choices)[idx];
 // Escolha válida, uma vez só: se outro "1" já levou as escolhas, a troca condicional falha e nada é aplicado nem respondido.
 if(choice){if(!await swapWaChoices(link.jid,link.choices,'[]'))return;
  // Se não salvar, as escolhas voltam (quando nada novo chegou), para o "Tente de novo" funcionar.
  const fail=async(err:unknown)=>{console.error('whatsapp choice',err);await swapWaChoices(link.jid,'[]',link.choices).catch(()=>false);return say('Não foi possível salvar agora. Tente de novo.');};
  let state;try{({state}=await loadWorkspace(link.userId,''));}catch(err){return fail(err);}
  const r=resolveChoice(choice,state,link.pending);
  if(r.command){try{await confirmCommand(link.userId,r.command);}catch(err){return fail(err);}}
  if(r.pending)await saveWaConversation(link.jid,pushHistory(link.history,[{role:'assistant',text:r.reply}]),r.pending);
  return say(r.reply);}
 // Qualquer outra mensagem apaga as escolhas antes da IA; um lembrete que chegar durante a chamada grava escolhas novas depois e continua valendo.
 if(link.choices!=='[]')await swapWaChoices(link.jid,link.choices,'[]');
 // Áudio vira texto antes da IA (comandos e "1/2" continuam digitados); a resposta começa com o que foi ouvido, e só o texto entra no histórico.
 let said=m.text,heard='';
 if(m.textless){const ready=voiceReady(),voice=m.voice;if(!voice||!ready)return say(mediaReply(ready));
  const h=await hear(link.userId,voice.seconds,()=>ctx.api.audio(voice));if('reply' in h)return say(h.reply);said=h.text;heard=heardLine(said)+'\n\n';}
 const cmd=waCommand(m.text);
 if(cmd==='desconectar'){await unlinkWaJid(m.jid);return say('WhatsApp desconectado do GeoAI. Para conectar de novo, use Configurações no app.');}
 if(cmd==='ajuda')return say(HELP);
 // Água ("bebi 500 ml", "água?", "desfazer água"): registra na hora, sem IA e sem 1/2.
 const water=parseWater(said);
 if(water){const reply=await waterChat({load:u=>loadWorkspace(u,''),mutate:(u,c)=>mutateWorkspace(u,'',c)},link.userId,water,'whatsapp');await say(heard+reply);return saveWaConversation(link.jid,pushHistory(link.history,[{role:'user',text:said},{role:'assistant',text:reply}]));}
 const turn=await agentTurn(link.userId,link.history,said,'whatsapp');if('error' in turn)return say(heard+turn.error);
 const {reply,items}=turn;let pending:Pending|undefined,choices:string[]|undefined,text=heard+reply;
 if(items.length){const id=newCode().slice(0,10);pending=addPending(link.pending,id,items);choices=['add:'+id,'drop:'+id];text=heard+reply+'\n\n'+proposalList(items)+'\n\nResponda 1 para adicionar ou 2 para descartar.';}
 await say(text);
 await saveWaConversation(link.jid,pushHistory(link.history,[{role:'user',text:said},{role:'assistant',text:reply+(items.length?'\n\n'+proposalsText(items):'')}]),pending,choices);}

import {todayInZone} from './core.ts';import {reminderDue,reminderText,waterButtons,waterSummary,sipsOf,waterDay,fmtMl,minutesInZone,type WaterIntent,type WaterVia} from './hydration.ts';import {byUser,sendToAll} from './reminder-channels.ts';import type {Workspace,Command} from './types.ts';
// Água pelo WhatsApp e pelo Telegram, com as dependências injetadas (banco e envio) para os testes.
type Load=(userId:string)=>Promise<{state:Workspace}>;type Mutate=(userId:string,command:Command)=>Promise<unknown>;
const FAILED='Não foi possível registrar agora. Tente de novo.';

// Mensagem já reconhecida como água ("bebi 500 ml", "água?", "desfazer água"): grava sem IA e sem confirmação e devolve a resposta.
export async function waterChat(d:{load:Load;mutate:(userId:string,command:Command)=>Promise<{state:Workspace}>;now?:Date},userId:string,intent:WaterIntent,via:Extract<WaterVia,'whatsapp'|'telegram'>){
 try{const {state}=await d.load(userId),today=todayInZone(state.profile.timezone,d.now);
  if(intent.kind==='status')return '💧 '+waterSummary(state,today);
  if(intent.kind==='undo'){const last=sipsOf(waterDay(state,today)).at(-1);if(!last)return 'Você ainda não registrou água hoje.';
   const after=await d.mutate(userId,{type:'water',action:'undo'});return 'Último registro de água desfeito ('+fmtMl(last.ml)+'). '+waterSummary(after.state,today);}
  const after=await d.mutate(userId,{type:'water',action:'add',ml:intent.ml,via});return '💧 +'+fmtMl(intent.ml)+'. '+waterSummary(after.state,today);}
 catch(e){console.error('water chat',e instanceof Error?e.message:'erro');return FAILED;}}

// Cron de hora em hora: lembra quem ligou os lembretes e está atrás do ritmo, em todas as conversas ligadas, e marca o envio no dia.
export type WaterReminderDeps={links:()=>Promise<{chatId:string;userId:string}[]>;load:Load;mutate:Mutate;send:(chatId:string,text:string,markup:typeof waterButtons)=>Promise<unknown>;now?:Date};
export async function sendWaterReminders(d:WaterReminderDeps){let checked=0,sent=0,failed=0;
 for(const [userId,chats] of byUser(await d.links())){checked++;
  try{const {state}=await d.load(userId),zone=state.profile.timezone,today=todayInZone(zone,d.now),due=reminderDue(state,today,minutesInZone(zone,d.now));if(!due)continue;
   const r=await sendToAll(d.send,chats,reminderText(due.total,due.goal,due.expected),waterButtons);sent+=r.sent;failed+=r.failed;if(r.sent)await d.mutate(userId,{type:'water',action:'reminded'});}
  catch(e){failed++;console.error('water reminder',e instanceof Error?e.message:'erro');}}
 return {checked,sent,failed};}

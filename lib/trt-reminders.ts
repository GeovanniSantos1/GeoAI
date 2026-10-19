import {todayInZone,addDays} from './core.ts';import {dueReminder,protocolStatus,doseId} from './testosterone.ts';import {hiddenSections} from './gender.ts';import type {Workspace,Command} from './types.ts';import {byUser,sendToAll} from './reminder-channels.ts';
// Lembrete diário das aplicações pelo Telegram e pelo WhatsApp. Texto discreto: a notificação aparece na tela de bloqueio.
export const REMINDER_TEXT='Lembrete do GeoAI: hoje é dia da sua aplicação.';
export const reminderButtons=(protocolId:string)=>({inline_keyboard:[[{text:'✅ Apliquei',callback_data:'trt:d:'+protocolId},{text:'Adiar 1 dia',callback_data:'trt:s:'+protocolId}]]});
export function parseTrtCallback(data:string){const m=/^trt:([ds]):([\w-]{1,56})$/.exec(data);return m?{action:m[1]==='d'?'done' as const:'snooze' as const,protocolId:m[2]}:null;}
export type ReminderDeps={links:()=>Promise<{chatId:string;userId:string}[]>;load:(userId:string)=>Promise<{state:Workspace}>;mutate:(userId:string,command:Command)=>Promise<unknown>;send:(chatId:string,text:string,markup:ReturnType<typeof reminderButtons>)=>Promise<unknown>;now?:Date};
export async function sendDueReminders(d:ReminderDeps){let checked=0,sent=0,failed=0;
 for(const [userId,chats] of byUser(await d.links())){checked++;
  try{const {state}=await d.load(userId);if(hiddenSections(state.profile.gender).includes('testosterona'))continue;const today=todayInZone(state.profile.timezone,d.now);
   for(const p of state.trtProtocols.filter(x=>dueReminder(x,state.trtDoses,today))){const r=await sendToAll(d.send,chats,REMINDER_TEXT,reminderButtons(p.id));sent+=r.sent;failed+=r.failed;if(r.sent)await d.mutate(userId,{type:'patch',collection:'trtProtocols',id:p.id,item:{remindedOn:today}});}}
  catch(e){failed++;console.error('trt reminder',e instanceof Error?e.message:'erro');}}
 return {checked,sent,failed};}
export function trtCallbackAction(s:Workspace,today:string,cb:{action:'done'|'snooze';protocolId:string}):{command?:Command;reply:string}{
 const p=s.trtProtocols.find(x=>x.id===cb.protocolId);if(!p)return {reply:'Este protocolo não existe mais no seu GeoAI.'};
 if(cb.action==='snooze')return {command:{type:'patch',collection:'trtProtocols',id:p.id,item:{snoozedUntil:addDays(today,1)}},reply:'Combinado, lembro amanhã.'};
 const fmtDate=(d:string)=>d.split('-').reverse().join('/');
 if(s.trtDoses.some(x=>x.protocolId===p.id&&x.date===today))return {reply:'A aplicação de hoje já estava registrada. Próxima: '+fmtDate(protocolStatus(p,s.trtDoses,today).next)+'.'};
 const id=doseId(p.id,today),dose={id,title:'Aplicação: '+p.title,date:today,protocolId:p.id,...(p.dose?{dose:p.dose}:{})};
 const next=protocolStatus(p,[...s.trtDoses.filter(x=>x.id!==id),dose],today).next;
 return {command:{type:'upsert',collection:'trtDoses',item:dose},reply:'Aplicação registrada. Próxima: '+fmtDate(next)+'.'};
}

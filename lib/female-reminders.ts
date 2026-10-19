import {todayInZone,addDays} from './core.ts';import {femaleReminderDue,dailyStatus,injectionNext,takeId,reminderHour} from './female-health.ts';import {hiddenSections} from './gender.ts';import type {Workspace,Command,Item} from './types.ts';import {byUser,sendToAll} from './reminder-channels.ts';
// Lembrete do anticoncepcional pelo Telegram e pelo WhatsApp, na hora escolhida. A Vercel chama a rota de hora em hora (24 crons diários);
// cada pessoa recebe no próprio fuso. Texto discreto: a notificação aparece na tela de bloqueio.
export const FEMALE_REMINDER_TEXT='Lembrete do GeoAI: hora do seu cuidado.';
export const femaleButtons=(m:{id:string;method?:string})=>({inline_keyboard:[[{text:'✅ Tomei',callback_data:'fh:d:'+m.id},m.method==='daily'?{text:'Lembrar em 1h',callback_data:'fh:h:'+m.id}:{text:'Adiar 1 dia',callback_data:'fh:s:'+m.id}]]});
const ACTIONS={d:'done',h:'hour',s:'snooze'} as const;
export function parseFemaleCallback(data:string){const m=/^fh:([dhs]):([\w-]{1,56})$/.exec(data);return m?{action:ACTIONS[m[1] as keyof typeof ACTIONS],methodId:m[2]}:null;}
export function hourInZone(zone:string,now=new Date()){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',hourCycle:'h23'}).format(now));}
export type FemaleReminderDeps={links:()=>Promise<{chatId:string;userId:string}[]>;load:(userId:string)=>Promise<{state:Workspace}>;mutate:(userId:string,command:Command)=>Promise<unknown>;send:(chatId:string,text:string,markup:ReturnType<typeof femaleButtons>)=>Promise<unknown>;now?:Date};
export async function sendFemaleReminders(d:FemaleReminderDeps){let checked=0,sent=0,failed=0;
 for(const [userId,chats] of byUser(await d.links())){checked++;
  try{const {state}=await d.load(userId);if(hiddenSections(state.profile.gender).includes('saude-feminina'))continue;
   const zone=state.profile.timezone,today=todayInZone(zone,d.now),hour=hourInZone(zone,d.now);
   for(const m of state.contraceptives.filter(x=>femaleReminderDue(x,state.contraceptiveDoses,today,hour))){const r=await sendToAll(d.send,chats,FEMALE_REMINDER_TEXT,femaleButtons(m));sent+=r.sent;failed+=r.failed;if(r.sent)await d.mutate(userId,{type:'patch',collection:'contraceptives',id:m.id,item:{remindedOn:today}});}}
  catch(e){failed++;console.error('female reminder',e instanceof Error?e.message:'erro');}}
 return {checked,sent,failed};}
const fmtDate=(d:string)=>d.split('-').reverse().join('/');
// `day` é o dia registrado; quando é ontem (resposta depois da meia-noite), o próximo uso é hoje.
function nextText(m:Item,doses:Item[],day:string,today:string){if(m.method==='injection')return 'Próxima injeção: '+fmtDate(injectionNext(m,doses))+'.';const late=day<today,next=dailyStatus(m,late?today:addDays(today,1));return next.active?(late?'Próxima: hoje.':'Próxima: amanhã.'):next.pauseUntil?'Pausa até '+fmtDate(next.pauseUntil).slice(0,5)+'.':'';}
// Campos vazios no patch são removidos pela validação: é assim que o adiamento e o "já lembrado" são limpos.
export function femaleCallbackAction(s:Workspace,today:string,hour:number,cb:{action:'done'|'hour'|'snooze';methodId:string}):{command?:Command;reply:string}{
 const m=s.contraceptives.find(x=>x.id===cb.methodId);if(!m)return {reply:'Este cuidado não existe mais no seu GeoAI.'};
 const patch=(item:Record<string,unknown>):Command=>({type:'patch',collection:'contraceptives',id:m.id,item});
 if(cb.action==='hour')return hour>=23?{command:patch({remindedOn:'',snoozedUntil:addDays(today,1),snoozeHour:''}),reply:'Combinado, lembro amanhã.'}:{command:patch({remindedOn:'',snoozedUntil:today,snoozeHour:hour+1}),reply:'Combinado, lembro daqui a 1 hora.'};
 if(cb.action==='snooze')return {command:patch({snoozedUntil:addDays(today,1),snoozeHour:''}),reply:'Combinado, lembro amanhã.'};
 const has=(d:string)=>s.contraceptiveDoses.some(x=>x.methodId===m.id&&x.date===d);
 // Tomei depois da meia-noite, respondendo ao lembrete de ontem e antes do horário de hoje, vale para ontem:
 // registrar hoje deixaria ontem em branco e calaria o lembrete de hoje.
 const day=m.remindedOn===addDays(today,-1)&&typeof m.time==='string'&&hour<reminderHour(m.time)&&!has(m.remindedOn)?m.remindedOn as string:today;
 if(has(day))return {reply:'O registro de hoje já estava feito. '+nextText(m,s.contraceptiveDoses,day,today)};
 const dose={id:takeId(m.id,day),title:(m.method==='injection'?'Injeção: ':'Tomei: ')+m.title,date:day,methodId:m.id};
 return {command:{type:'upsert',collection:'contraceptiveDoses',item:dose},reply:(day<today?'Registrado para ontem. ':'Registrado. ')+nextText(m,[...s.contraceptiveDoses,dose],day,today)};
}

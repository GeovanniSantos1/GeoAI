import {todayInZone,addDays} from './core.ts';import {femaleReminderDue,dailyStatus,injectionNext,takeId} from './female-health.ts';import {hiddenSections} from './gender.ts';import type {Workspace,Command,Item} from './types.ts';
// Lembrete do anticoncepcional pelo Telegram, na hora escolhida. A Vercel chama a rota de hora em hora (24 crons diários);
// cada pessoa recebe no próprio fuso. Texto discreto: a notificação aparece na tela de bloqueio.
export const FEMALE_REMINDER_TEXT='Lembrete do GeoAI: hora do seu cuidado.';
export const femaleButtons=(m:{id:string;method?:string})=>({inline_keyboard:[[{text:'✅ Tomei',callback_data:'fh:d:'+m.id},m.method==='daily'?{text:'Lembrar em 1h',callback_data:'fh:h:'+m.id}:{text:'Adiar 1 dia',callback_data:'fh:s:'+m.id}]]});
const ACTIONS={d:'done',h:'hour',s:'snooze'} as const;
export function parseFemaleCallback(data:string){const m=/^fh:([dhs]):([\w-]{1,56})$/.exec(data);return m?{action:ACTIONS[m[1] as keyof typeof ACTIONS],methodId:m[2]}:null;}
export function hourInZone(zone:string,now=new Date()){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',hourCycle:'h23'}).format(now));}
export type FemaleReminderDeps={links:()=>Promise<{chatId:string;userId:string}[]>;load:(userId:string)=>Promise<{state:Workspace}>;mutate:(userId:string,command:Command)=>Promise<unknown>;send:(chatId:string,text:string,markup:ReturnType<typeof femaleButtons>)=>Promise<unknown>;now?:Date};
export async function sendFemaleReminders(d:FemaleReminderDeps){let checked=0,sent=0,failed=0;
 for(const link of await d.links()){checked++;
  try{const {state}=await d.load(link.userId);if(hiddenSections(state.profile.gender).includes('saude-feminina'))continue;
   const zone=state.profile.timezone,today=todayInZone(zone,d.now),hour=hourInZone(zone,d.now);
   for(const m of state.contraceptives.filter(x=>femaleReminderDue(x,state.contraceptiveDoses,today,hour))){await d.send(link.chatId,FEMALE_REMINDER_TEXT,femaleButtons(m));sent++;await d.mutate(link.userId,{type:'patch',collection:'contraceptives',id:m.id,item:{remindedOn:today}});}}
  catch(e){failed++;console.error('female reminder',e instanceof Error?e.message:'erro');}}
 return {checked,sent,failed};}
const fmtDate=(d:string)=>d.split('-').reverse().join('/');
function nextText(m:Item,doses:Item[],today:string){if(m.method==='injection')return 'Próxima injeção: '+fmtDate(injectionNext(m,doses))+'.';const tomorrow=dailyStatus(m,addDays(today,1));return tomorrow.active?'Próxima: amanhã.':tomorrow.pauseUntil?'Pausa até '+fmtDate(tomorrow.pauseUntil).slice(0,5)+'.':'';}
// Campos vazios no patch são removidos pela validação: é assim que o adiamento e o "já lembrado" são limpos.
export function femaleCallbackAction(s:Workspace,today:string,hour:number,cb:{action:'done'|'hour'|'snooze';methodId:string}):{command?:Command;reply:string}{
 const m=s.contraceptives.find(x=>x.id===cb.methodId);if(!m)return {reply:'Este cuidado não existe mais no seu GeoAI.'};
 const patch=(item:Record<string,unknown>):Command=>({type:'patch',collection:'contraceptives',id:m.id,item});
 if(cb.action==='hour')return hour>=23?{command:patch({remindedOn:'',snoozedUntil:addDays(today,1),snoozeHour:''}),reply:'Combinado, lembro amanhã.'}:{command:patch({remindedOn:'',snoozedUntil:today,snoozeHour:hour+1}),reply:'Combinado, lembro daqui a 1 hora.'};
 if(cb.action==='snooze')return {command:patch({snoozedUntil:addDays(today,1),snoozeHour:''}),reply:'Combinado, lembro amanhã.'};
 if(s.contraceptiveDoses.some(x=>x.methodId===m.id&&x.date===today))return {reply:'O registro de hoje já estava feito. '+nextText(m,s.contraceptiveDoses,today)};
 const dose={id:takeId(m.id,today),title:(m.method==='injection'?'Injeção: ':'Tomei: ')+m.title,date:today,methodId:m.id};
 return {command:{type:'upsert',collection:'contraceptiveDoses',item:dose},reply:'Registrado. '+nextText(m,[...s.contraceptiveDoses,dose],today)};
}

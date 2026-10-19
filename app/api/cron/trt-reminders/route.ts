import {sendDueReminders} from '@/lib/trt-reminders';import {listLinks} from '@/lib/telegram-store';import {listWaLinks} from '@/lib/whatsapp-store';import {waContext,sendWaReminder} from '@/lib/whatsapp-server';import {loadWorkspace,mutateWorkspace} from '@/lib/workspace-server';import {telegramApi} from '@/lib/telegram';
export const dynamic='force-dynamic';export const maxDuration=60;
// Uma falha ao listar um canal não derruba o outro: registra no log e segue sem as conversas dele.
const orNone=(channel:string)=>(e:unknown)=>{console.error('reminder links',channel,e instanceof Error?e.message:'erro');return [];};
// Chamada pela tarefa agendada da Vercel, que envia Authorization: Bearer <CRON_SECRET>.
export async function GET(request:Request){const secret=process.env.CRON_SECRET,token=process.env.TELEGRAM_BOT_TOKEN;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 const tg=token?telegramApi(token,process.env.TELEGRAM_API_BASE||undefined):null,wa=waContext();
 if(!tg&&!wa)return Response.json({checked:0,sent:0,failed:0});
 return Response.json(await sendDueReminders({links:async()=>[...(tg?await listLinks().catch(orNone('telegram')):[]),...(wa?await listWaLinks().catch(orNone('whatsapp')):[])],load:userId=>loadWorkspace(userId,''),mutate:(userId,command)=>mutateWorkspace(userId,'',command),send:(chatId,text,markup)=>chatId.startsWith('wa:')?sendWaReminder(wa!.api,chatId,text,markup):tg!('sendMessage',{chat_id:chatId,text,reply_markup:markup})}));}

import {sendFemaleReminders} from '@/lib/female-reminders';import {listLinks} from '@/lib/telegram-store';import {loadWorkspace,mutateWorkspace} from '@/lib/workspace-server';import {telegramApi} from '@/lib/telegram';
export const dynamic='force-dynamic';export const maxDuration=60;
// Chamada de hora em hora por 24 tarefas agendadas diárias da Vercel (a Hobby só permite cron diário), com Authorization: Bearer <CRON_SECRET>.
export async function GET(request:Request){const secret=process.env.CRON_SECRET,token=process.env.TELEGRAM_BOT_TOKEN;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 if(!token)return Response.json({checked:0,sent:0,failed:0});
 const api=telegramApi(token,process.env.TELEGRAM_API_BASE||undefined);
 return Response.json(await sendFemaleReminders({links:listLinks,load:userId=>loadWorkspace(userId,''),mutate:(userId,command)=>mutateWorkspace(userId,'',command),send:(chatId,text,markup)=>api('sendMessage',{chat_id:chatId,text,reply_markup:markup})}));}

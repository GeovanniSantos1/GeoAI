import {calendarDeps} from '@/lib/calendar-server';import {syncAll} from '@/lib/calendar-sync';
export const dynamic='force-dynamic';export const maxDuration=60;
// Chamada pela tarefa agendada da Vercel, que envia Authorization: Bearer <CRON_SECRET>. Responde só com contagens.
export async function GET(request:Request){const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 return Response.json(await syncAll(calendarDeps()));}

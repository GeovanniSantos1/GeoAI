import {calendarDeps} from '@/lib/calendar-server';import {syncAll} from '@/lib/calendar-sync';import {onlyActive} from '@/lib/billing-server';
export const dynamic='force-dynamic';export const maxDuration=60;
// Chamada pela tarefa agendada da Vercel, que envia Authorization: Bearer <CRON_SECRET>. Responde só com contagens.
export async function GET(request:Request){const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 // Contas com o acesso vencido ficam fora da sincronização.
 const deps=calendarDeps();return Response.json(await syncAll({...deps,store:{...deps.store,all:async()=>onlyActive(await deps.store.all())}}));}

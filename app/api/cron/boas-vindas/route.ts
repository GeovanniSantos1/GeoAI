import {welcomeSweep} from '@/lib/email-server';
export const dynamic='force-dynamic';export const maxDuration=60;
// Envio diário das boas-vindas para quem ainda não recebeu (contas antigas e quem nunca abriu o app), até 40 por dia.
// Chamada pela tarefa agendada da Vercel, com Authorization: Bearer <CRON_SECRET>.
export async function GET(request:Request){const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!=='Bearer '+secret)return new Response('Unauthorized',{status:401});
 try{return Response.json(await welcomeSweep());}
 catch(e){console.error('email:sweep',e instanceof Error?e.message:'erro');return new Response('Erro',{status:500});}}

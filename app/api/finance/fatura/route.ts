import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {readFaturaWithAi} from '@/lib/fatura-ai';import {consumeQuota} from '@/lib/quota';import {todayInZone} from '@/lib/core';import {requireAccess} from '@/lib/billing-server';
export const dynamic='force-dynamic';export const maxDuration=60;
// "Ler com a IA" da importação de fatura: só o texto chega aqui (o PDF fica no aparelho) e nada é guardado.
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);const blocked=await requireAccess(userId);if(blocked)return blocked;
 let body:{text?:unknown}|null;try{body=await request.json();}catch{return jsonError('Formato inválido',415);}
 const text=typeof body?.text==='string'?body.text:'';if(!text.trim())return jsonError('Envie o texto da fatura.',400);if(text.length>120000)return jsonError('Texto da fatura grande demais.',413);
 try{if(!await consumeQuota(userId,'fatura_ai',todayInZone()))return jsonError('Você chegou ao limite de leituras com IA de hoje. Tente amanhã.',429);
  return Response.json(await readFaturaWithAi(text),{headers:{'Cache-Control':'no-store'}});}
 catch(e){const message=e instanceof Error?e.message:'';if(message==='IA não configurada')return jsonError('A leitura com IA não está configurada.',503);console.error('fatura:ai',message);return jsonError('Não consegui ler a fatura com a IA. Tente de novo.',502);}}

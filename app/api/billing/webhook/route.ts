import {webhookConfig,verifyWebhook,readEvent} from '@/lib/abacatepay';import {applyBillingEvent} from '@/lib/billing-server';
export const dynamic='force-dynamic';
// Webhook da AbacatePay: exige o webhookSecret da URL e o HMAC do corpo. Qualquer 2xx conta como entregue; 5xx faz a AbacatePay
// tentar de novo (até 7 vezes em ~18 h). Sem configuração, ou com o segredo certo e o HMAC diferente, o app responde 503 para o
// evento não se perder enquanto o problema é corrigido; 400 e 401 (não repetidos) só saem quando repetir não resolveria.
export async function POST(request:Request){const cfg=webhookConfig();if(!cfg){console.error('billing:webhook sem configuração');return new Response('Not configured',{status:503});}
 const raw=await request.text(),check=verifyWebhook(raw,request.headers.get('x-webhook-signature'),new URL(request.url).searchParams.get('webhookSecret'),cfg.webhookSecret);
 if(check==='secret'){console.warn('billing:webhook recusado (segredo)');return new Response('Unauthorized',{status:401});}
 if(check==='signature'){console.error('billing:webhook com segredo certo e HMAC diferente; a AbacatePay vai tentar de novo');return new Response('Signature mismatch',{status:503});}
 let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return new Response('Bad request',{status:400});}
 const event=readEvent(parsed);if(!event)return Response.json({ok:true});
 try{const result=await applyBillingEvent(event,cfg.products);if(result==='unknown')console.warn('billing:webhook sem conta',event.event,event.id);return Response.json({ok:true,result});}
 catch(e){console.error('billing:webhook',event.event,e instanceof Error?e.message:'erro');return new Response('Erro',{status:500});}}

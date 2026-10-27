import {abacateConfig,verifyWebhook,readEvent} from '@/lib/abacatepay';import {applyBillingEvent} from '@/lib/billing-server';
export const dynamic='force-dynamic';
// Webhook da AbacatePay: exige o webhookSecret da URL e o HMAC do corpo. Qualquer 2xx conta como entregue; o 500 faz a AbacatePay
// tentar de novo (até 7 vezes em ~18 h). 400 e 401 não são repetidos, então só saem quando repetir não resolveria.
export async function POST(request:Request){const cfg=abacateConfig();if(!cfg)return new Response('Not found',{status:404});
 const raw=await request.text();
 if(!verifyWebhook(raw,request.headers.get('x-webhook-signature'),new URL(request.url).searchParams.get('webhookSecret'),cfg.webhookSecret)){console.warn('billing:webhook recusado (segredo ou assinatura)');return new Response('Unauthorized',{status:401});}
 let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return new Response('Bad request',{status:400});}
 const event=readEvent(parsed);if(!event)return Response.json({ok:true});
 try{const result=await applyBillingEvent(event,cfg.products);if(result==='unknown')console.warn('billing:webhook sem conta',event.event,event.id);return Response.json({ok:true,result});}
 catch(e){console.error('billing:webhook',event.event,e instanceof Error?e.message:'erro');return new Response('Erro',{status:500});}}

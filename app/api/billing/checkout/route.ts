import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {abacateConfig,abacateApi,subscriptionBody} from '@/lib/abacatepay';import {billingFor,recordCheckout} from '@/lib/billing-server';import {isPlan} from '@/lib/billing';
export const dynamic='force-dynamic';
// Cria o checkout de assinatura na AbacatePay (só cartão) e devolve a URL de pagamento; a liberação chega depois pelo webhook.
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 const cfg=abacateConfig();if(!cfg)return jsonError('A assinatura ainda não está disponível.',503);
 const body=await request.json().catch(()=>null) as {plan?:unknown}|null;const plan=body?.plan;if(!isPlan(plan))return jsonError('Plano inválido',400);
 try{const billing=await billingFor(userId);if(!billing.canSubscribe)return jsonError('Você já tem acesso.',409);
  const bill=await abacateApi(cfg.apiKey).createSubscription(subscriptionBody(plan,cfg.products,userId,new URL(request.url).origin));
  if(!bill.id||!/^https:\/\//.test(bill.url||''))throw new Error('checkout sem id ou url');
  await recordCheckout(bill.id,userId,plan);return Response.json({url:bill.url},{headers:{'Cache-Control':'no-store'}});}
 catch(e){console.error('billing:checkout',e instanceof Error?e.message:'erro');return jsonError('Não foi possível abrir o pagamento. Tente de novo.',502);}}

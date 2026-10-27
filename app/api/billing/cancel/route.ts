import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {abacateConfig,abacateApi} from '@/lib/abacatepay';import {accountOf,markCancelled,billingFor} from '@/lib/billing-server';
export const dynamic='force-dynamic';
// A AbacatePay cancela na hora; o app guarda a data e mantém o acesso até o fim do período já pago, como dizem os Termos.
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 const cfg=abacateConfig();if(!cfg)return jsonError('A assinatura ainda não está disponível.',503);
 try{const a=await accountOf(userId);if(!a?.subscriptionId||a.cancelledAt)return jsonError('Não há renovação para cancelar.',409);
  await abacateApi(cfg.apiKey).cancelSubscription(a.subscriptionId);await markCancelled(userId);
  return Response.json({billing:await billingFor(userId)},{headers:{'Cache-Control':'no-store'}});}
 catch(e){console.error('billing:cancel',e instanceof Error?e.message:'erro');return jsonError('Não foi possível cancelar agora. Tente de novo ou fale com a gente.',502);}}

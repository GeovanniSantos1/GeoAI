import {getUserId} from '@/lib/auth';import {jsonError} from '@/lib/workspace-server';import {abacateConfig,abacateApi} from '@/lib/abacatepay';import {PLAN_NAMES,type PlanOffer} from '@/lib/billing';
export const dynamic='force-dynamic';
// Preços lidos dos produtos na AbacatePay (o proprietário muda lá, sem deploy), guardados por 10 minutos em cada instância.
let cache:{at:number;plans:PlanOffer[]}|null=null;
export async function GET(){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);
 const cfg=abacateConfig();if(!cfg)return jsonError('A assinatura ainda não está disponível.',503);
 try{if(!cache||Date.now()-cache.at>600000){const api=abacateApi(cfg.apiKey),[m,a]=await Promise.all([api.product(cfg.products.monthly),api.product(cfg.products.annual)]);
   cache={at:Date.now(),plans:[{plan:'monthly',name:PLAN_NAMES.monthly,price:m.price},{plan:'annual',name:PLAN_NAMES.annual,price:a.price}]};}
  return Response.json({plans:cache.plans},{headers:{'Cache-Control':'no-store'}});}
 catch(e){console.error('billing:plans',e instanceof Error?e.message:'erro');return jsonError('Não foi possível carregar os planos. Tente de novo.',503);}}

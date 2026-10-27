// Assinatura: regras de acesso, datas do período pago e o efeito de cada evento da AbacatePay. Puro; o banco entra pelo BillingRepo.
import {LEGAL} from './legal.ts';

export const TRIAL_DAYS=3,GRACE_DAYS=3;
const DAY=86400000;
export type Plan='monthly'|'annual';
export type Products=Record<Plan,string>;
export type BillingStatus='off'|'free'|'active'|'trial'|'expired';
export type BillingAccount={userId:string;free:boolean;trialEndsAt:string;paidUntil:string|null;plan:Plan|null;subscriptionId:string|null;customerId:string|null;cancelledAt:string|null;refundedAt:string|null};
// O que o app mostra: until é o fim do teste ou do período pago (sem a folga); late indica que o período acabou e a renovação ainda não chegou;
// paidBefore separa "teste acabou" de "assinatura venceu".
export type BillingView={status:BillingStatus;plan:Plan|null;until:string|null;cancelled:boolean;late:boolean;canSubscribe:boolean;canCancel:boolean;paidBefore:boolean};
export type PlanOffer={plan:Plan;name:string;price:number};
export const BILLING_OFF:BillingView={status:'off',plan:null,until:null,cancelled:false,late:false,canSubscribe:false,canCancel:false,paidBefore:false};
export const PLAN_NAMES:Record<Plan,string>={monthly:'Mensal',annual:'Anual'};
export const EXPIRED_ERROR='Seu acesso venceu. Assine para continuar.';
export const EXPIRED_TEXT='Seu acesso ao GeoAI venceu. Para voltar a usar o assistente e os lembretes, assine em '+LEGAL.site+'.';
export const isPlan=(v:unknown):v is Plan=>v==='monthly'||v==='annual';
export const hasAccess=(v:BillingView)=>v.status!=='expired';

export function newAccount(userId:string,now:Date):BillingAccount{return {userId,free:false,trialEndsAt:new Date(now.getTime()+TRIAL_DAYS*DAY).toISOString(),paidUntil:null,plan:null,subscriptionId:null,customerId:null,cancelledAt:null,refundedAt:null};}

// Ordem: grátis, pago (com folga para as novas tentativas de cobrança, menos depois de um reembolso), teste, vencido.
// Com uma assinatura viva na AbacatePay não se assina de novo (evita cobrança em dobro); ela pode ser cancelada em qualquer situação.
export function accessOf(a:BillingAccount,now:Date):BillingView{const t=now.getTime(),cancelled=!!a.cancelledAt,live=!!a.subscriptionId&&!cancelled,base={plan:a.plan,cancelled,late:false,paidBefore:!!a.paidUntil,canSubscribe:!live,canCancel:live};
 if(a.free)return {...base,status:'free',until:null,canSubscribe:false};
 if(a.paidUntil&&t<Date.parse(a.paidUntil)+(a.refundedAt?0:GRACE_DAYS*DAY))return {...base,status:'active',until:a.paidUntil,late:t>=Date.parse(a.paidUntil)};
 if(t<Date.parse(a.trialEndsAt))return {...base,status:'trial',until:a.trialEndsAt};
 return {...base,status:'expired',until:null};}

// Soma 1 mês (ou 12) mantendo o dia; em mês mais curto, cai no último dia (31/01 → 28/02).
export function addPeriod(from:Date,plan:Plan){const d=new Date(from.getTime()),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+(plan==='annual'?12:1));d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d;}
// Cada pagamento soma um período a partir do que vier depois: o fim do período atual ou agora. Assinar de novo com dias pagos não os perde;
// a mesma entrega duas vezes é barrada antes, pelo id do evento.
export function extendPaid(current:string|null,now:Date,plan:Plan){const from=current&&Date.parse(current)>now.getTime()?new Date(current):now;return addPeriod(from,plan).toISOString();}

export type BillingEvent={id:string;event:string;devMode:boolean;subscriptionId:string|null;customerId:string|null;checkoutId:string|null;frequency:string|null;productId:string|null;userId:string|null};
export function planOfEvent(e:BillingEvent,products:Products):Plan|null{if(e.frequency==='MONTHLY')return 'monthly';if(e.frequency==='ANNUALLY')return 'annual';if(e.productId===products.monthly)return 'monthly';if(e.productId===products.annual)return 'annual';return null;}

export type Patch=Partial<Omit<BillingAccount,'userId'>>;
// hint: o plano escolhido no checkout, usado quando o evento não diz a frequência nem o produto.
export function eventPatch(e:BillingEvent,a:BillingAccount,now:Date,products:Products,hint:Plan|null=null):Patch|null{const at=now.toISOString(),plan=planOfEvent(e,products)??hint??a.plan??'monthly';
 switch(e.event){
  case 'subscription.completed':return {plan,subscriptionId:e.subscriptionId??a.subscriptionId,customerId:e.customerId??a.customerId,paidUntil:extendPaid(a.paidUntil,now,plan),cancelledAt:null,refundedAt:null};
  case 'subscription.renewed':return {plan,paidUntil:extendPaid(a.paidUntil,now,plan),refundedAt:null};
  case 'subscription.cancelled':return a.cancelledAt?null:{cancelledAt:at};
  // Reembolso (arrependimento): o acesso pago acaba e a assinatura é cancelada, para não haver nova cobrança.
  case 'checkout.refunded':return {paidUntil:at,refundedAt:at,cancelledAt:a.cancelledAt??at};
  default:return null;}}

export type CheckoutRef={userId:string;plan:Plan|null};
export type BillingRepo={claim:(e:BillingEvent)=>Promise<boolean>;checkout:(id:string)=>Promise<CheckoutRef|null>;account:(userId:string)=>Promise<BillingAccount|null>;accountBy:(field:'subscriptionId'|'customerId',value:string)=>Promise<BillingAccount|null>;save:(userId:string,patch:Patch)=>Promise<void>};
export type EventResult='duplicate'|'ignored'|'unknown'|'applied';
// cancel: assinatura que ainda precisa ser cancelada na AbacatePay depois de gravar (reembolso, ou uma segunda assinatura da mesma conta).
export type EventOutcome={result:EventResult;cancel?:string};
const HANDLED=new Set(['subscription.completed','subscription.renewed','subscription.cancelled','checkout.refunded']);
// A ativação chega com o bill_ que criamos (ou o userId do metadata); renovação e cancelamento, com o subs_; reembolso, com o bill_ ou o cliente.
async function locate(repo:BillingRepo,e:BillingEvent):Promise<{account:BillingAccount;hint:Plan|null}|null>{
 const ref=e.checkoutId&&(e.event==='subscription.completed'||e.event==='checkout.refunded')?await repo.checkout(e.checkoutId):null;
 const own=ref?await repo.account(ref.userId):null;if(own)return {account:own,hint:ref!.plan};
 const other=e.event==='checkout.refunded'?(e.customerId?await repo.accountBy('customerId',e.customerId):null):(e.subscriptionId?await repo.accountBy('subscriptionId',e.subscriptionId):null);
 if(other)return {account:other,hint:null};
 const byMeta=e.event==='subscription.completed'&&e.userId?await repo.account(e.userId):null;return byMeta?{account:byMeta,hint:null}:null;}
// O id do evento é gravado primeiro (na mesma transação): uma retentativa do mesmo evento não se aplica duas vezes.
export async function processEvent(repo:BillingRepo,e:BillingEvent,now:Date,products:Products):Promise<EventOutcome>{
 if(!await repo.claim(e))return {result:'duplicate'};
 if(!HANDLED.has(e.event))return {result:'ignored'};
 const found=await locate(repo,e);if(!found)return {result:'unknown'};
 const a=found.account,patch=eventPatch(e,a,now,products,found.hint);if(!patch)return {result:'ignored'};
 // A assinatura viva é lida antes de gravar: depois do save, a conta já aponta para a nova.
 const live=a.subscriptionId&&!a.cancelledAt?a.subscriptionId:null;
 await repo.save(a.userId,patch);
 const cancel=e.event==='checkout.refunded'?live:e.event==='subscription.completed'&&e.subscriptionId&&live!==e.subscriptionId?live:null;
 return cancel?{result:'applied',cancel}:{result:'applied'};}

export function annualSaving(monthly:number,annual:number){if(monthly<=0)return 0;const pct=Math.round((1-annual/(monthly*12))*100);return pct>0?pct:0;}
export function isFreeEmail(email:string,list:string|undefined){const e=email.trim().toLowerCase();return !!e&&(list||'').split(',').some(x=>x.trim().toLowerCase()===e);}

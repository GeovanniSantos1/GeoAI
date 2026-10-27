// Assinatura: regras de acesso, datas do período pago e o efeito de cada evento da AbacatePay. Puro; o banco entra pelo BillingRepo.
import {LEGAL} from './legal.ts';

export const TRIAL_DAYS=3,GRACE_DAYS=3;
const DAY=86400000;
export type Plan='monthly'|'annual';
export type Products=Record<Plan,string>;
export type BillingStatus='off'|'free'|'active'|'trial'|'expired';
export type BillingAccount={userId:string;free:boolean;trialEndsAt:string;paidUntil:string|null;plan:Plan|null;subscriptionId:string|null;customerId:string|null;cancelledAt:string|null;refundedAt:string|null};
// O que o app mostra: until é o fim do teste ou do período pago (sem a folga); paidBefore separa "teste acabou" de "assinatura venceu".
export type BillingView={status:BillingStatus;plan:Plan|null;until:string|null;cancelled:boolean;canSubscribe:boolean;canCancel:boolean;paidBefore:boolean};
export type PlanOffer={plan:Plan;name:string;price:number};
export const BILLING_OFF:BillingView={status:'off',plan:null,until:null,cancelled:false,canSubscribe:false,canCancel:false,paidBefore:false};
export const PLAN_NAMES:Record<Plan,string>={monthly:'Mensal',annual:'Anual'};
export const EXPIRED_ERROR='Seu acesso venceu. Assine para continuar.';
export const EXPIRED_TEXT='Seu acesso ao GeoAI venceu. Para voltar a usar o assistente e os lembretes, assine em '+LEGAL.site+'.';
export const isPlan=(v:unknown):v is Plan=>v==='monthly'||v==='annual';
export const hasAccess=(v:BillingView)=>v.status!=='expired';

export function newAccount(userId:string,now:Date):BillingAccount{return {userId,free:false,trialEndsAt:new Date(now.getTime()+TRIAL_DAYS*DAY).toISOString(),paidUntil:null,plan:null,subscriptionId:null,customerId:null,cancelledAt:null,refundedAt:null};}

// Ordem: grátis, pago (com folga para as novas tentativas de cobrança, menos depois de um reembolso), teste, vencido.
export function accessOf(a:BillingAccount,now:Date):BillingView{const t=now.getTime(),cancelled=!!a.cancelledAt,base={plan:a.plan,cancelled,paidBefore:!!a.paidUntil};
 if(a.free)return {...base,status:'free',until:null,canSubscribe:false,canCancel:false};
 if(a.paidUntil&&t<Date.parse(a.paidUntil)+(a.refundedAt?0:GRACE_DAYS*DAY))return {...base,status:'active',until:a.paidUntil,canSubscribe:cancelled,canCancel:!cancelled&&!!a.subscriptionId};
 if(t<Date.parse(a.trialEndsAt))return {...base,status:'trial',until:a.trialEndsAt,canSubscribe:true,canCancel:false};
 return {...base,status:'expired',until:null,canSubscribe:true,canCancel:false};}

// Soma 1 mês (ou 12) mantendo o dia; em mês mais curto, cai no último dia (31/01 → 28/02).
export function addPeriod(from:Date,plan:Plan){const d=new Date(from.getTime()),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+(plan==='annual'?12:1));d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d;}
// Nunca encurta: um evento atrasado ou fora de ordem não tira dias já pagos.
export function extendPaid(current:string|null,now:Date,plan:Plan){const next=addPeriod(now,plan).toISOString();return current&&Date.parse(current)>Date.parse(next)?current:next;}

export type BillingEvent={id:string;event:string;devMode:boolean;subscriptionId:string|null;customerId:string|null;checkoutId:string|null;frequency:string|null;productId:string|null};
export function planOfEvent(e:BillingEvent,products:Products):Plan|null{if(e.frequency==='MONTHLY')return 'monthly';if(e.frequency==='ANNUALLY')return 'annual';if(e.productId===products.monthly)return 'monthly';if(e.productId===products.annual)return 'annual';return null;}

export type Patch=Partial<Omit<BillingAccount,'userId'>>;
export function eventPatch(e:BillingEvent,a:BillingAccount,now:Date,products:Products):Patch|null{const at=now.toISOString(),plan=planOfEvent(e,products)??a.plan??'monthly';
 switch(e.event){
  case 'subscription.completed':return {plan,subscriptionId:e.subscriptionId??a.subscriptionId,customerId:e.customerId??a.customerId,paidUntil:extendPaid(a.paidUntil,now,plan),cancelledAt:null,refundedAt:null};
  case 'subscription.renewed':return {plan,paidUntil:extendPaid(a.paidUntil,now,plan),refundedAt:null};
  case 'subscription.cancelled':return a.cancelledAt?null:{cancelledAt:at};
  case 'checkout.refunded':return {paidUntil:at,refundedAt:at};
  default:return null;}}

export type BillingRepo={claim:(e:BillingEvent)=>Promise<boolean>;userOfCheckout:(id:string)=>Promise<string|null>;account:(userId:string)=>Promise<BillingAccount|null>;accountBy:(field:'subscriptionId'|'customerId',value:string)=>Promise<BillingAccount|null>;save:(userId:string,patch:Patch)=>Promise<void>};
export type EventResult='duplicate'|'ignored'|'unknown'|'applied';
const HANDLED=new Set(['subscription.completed','subscription.renewed','subscription.cancelled','checkout.refunded']);
// A ativação chega com o bill_ que criamos; renovação e cancelamento, com o subs_; reembolso, com o bill_ ou o cliente.
async function locate(repo:BillingRepo,e:BillingEvent){const by=(field:'subscriptionId'|'customerId',value:string|null)=>value?repo.accountBy(field,value):Promise.resolve(null);
 const userId=e.checkoutId&&(e.event==='subscription.completed'||e.event==='checkout.refunded')?await repo.userOfCheckout(e.checkoutId):null;
 const own=userId?await repo.account(userId):null;if(own)return own;
 return e.event==='checkout.refunded'?by('customerId',e.customerId):by('subscriptionId',e.subscriptionId);}
// O id do evento é gravado primeiro (na mesma transação): uma retentativa do mesmo evento não se aplica duas vezes.
export async function processEvent(repo:BillingRepo,e:BillingEvent,now:Date,products:Products):Promise<EventResult>{
 if(!await repo.claim(e))return 'duplicate';
 if(!HANDLED.has(e.event))return 'ignored';
 const a=await locate(repo,e);if(!a)return 'unknown';
 const patch=eventPatch(e,a,now,products);if(!patch)return 'ignored';
 await repo.save(a.userId,patch);return 'applied';}

export function annualSaving(monthly:number,annual:number){if(monthly<=0)return 0;const pct=Math.round((1-annual/(monthly*12))*100);return pct>0?pct:0;}
export function isFreeEmail(email:string,list:string|undefined){const e=email.trim().toLowerCase();return !!e&&(list||'').split(',').some(x=>x.trim().toLowerCase()===e);}

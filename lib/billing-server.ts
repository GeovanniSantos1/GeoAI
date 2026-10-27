// Assinatura no banco: cria a conta com o teste, calcula o acesso, trava as rotas e aplica os webhooks numa transação.
import {eq,inArray} from 'drizzle-orm';import {getDb} from '@/db';import {billingAccounts,billingCheckouts,billingEvents} from '@/db/schema';
import {accessOf,hasAccess,newAccount,processEvent,isFreeEmail,isPlan,BILLING_OFF,EXPIRED_ERROR,type BillingAccount,type BillingView,type BillingRepo,type BillingEvent,type Plan,type Products} from './billing';
import {abacateConfig} from './abacatepay';

type Row=typeof billingAccounts.$inferSelect;
type Db=ReturnType<typeof getDb>;type Tx=Parameters<Parameters<Db['transaction']>[0]>[0];
const toAccount=(r:Row):BillingAccount=>({userId:r.userId,free:r.free,trialEndsAt:r.trialEndsAt,paidUntil:r.paidUntil,plan:isPlan(r.plan)?r.plan:null,subscriptionId:r.subscriptionId,customerId:r.customerId,cancelledAt:r.cancelledAt,refundedAt:r.refundedAt});
const byUser=async(db:Db|Tx,userId:string)=>{const r=(await db.select().from(billingAccounts).where(eq(billingAccounts.userId,userId)).limit(1))[0];return r?toAccount(r):null;};

// O teste começa na primeira vez que o app pede o acesso da conta.
export async function ensureAccount(userId:string,now=new Date()){const db=getDb(),found=await byUser(db,userId);if(found)return found;
 await db.insert(billingAccounts).values({...newAccount(userId,now),updatedAt:now.toISOString()}).onConflictDoNothing();return (await byUser(db,userId))!;}

// Com o e-mail (só o GET /api/state o tem), quem está em BILLING_FREE_EMAILS vira conta grátis de vez.
export async function billingFor(userId:string,email=''):Promise<BillingView>{if(!abacateConfig())return BILLING_OFF;let a=await ensureAccount(userId);
 if(!a.free&&isFreeEmail(email,process.env.BILLING_FREE_EMAILS)){await getDb().update(billingAccounts).set({free:true,updatedAt:new Date().toISOString()}).where(eq(billingAccounts.userId,userId));a={...a,free:true};}
 return accessOf(a,new Date());}

// 402 quando o acesso venceu. Uma falha do banco aqui não bloqueia ninguém: a própria operação vai acusar o erro.
export async function requireAccess(userId:string):Promise<Response|null>{let billing:BillingView;try{billing=await billingFor(userId);}catch(e){console.error('billing:access',e instanceof Error?e.message:'erro');return null;}
 return hasAccess(billing)?null:Response.json({error:EXPIRED_ERROR,billing},{status:402,headers:{'Cache-Control':'no-store'}});}
export const userHasAccess=async(userId:string)=>!await requireAccess(userId);

// Lembretes e sincronização: tira as contas vencidas. Conta sem registro ainda não abriu o app com a cobrança ligada e segue no teste.
export async function onlyActive<T extends {userId:string}>(rows:T[]):Promise<T[]>{if(!abacateConfig()||!rows.length)return rows;
 try{const ids=[...new Set(rows.map(r=>r.userId))],now=new Date();const accounts=await getDb().select().from(billingAccounts).where(inArray(billingAccounts.userId,ids));
  const blocked=new Set(accounts.filter(r=>!hasAccess(accessOf(toAccount(r),now))).map(r=>r.userId));return rows.filter(r=>!blocked.has(r.userId));}
 catch(e){console.error('billing:filter',e instanceof Error?e.message:'erro');return rows;}}

export async function recordCheckout(id:string,userId:string,plan:Plan){await getDb().insert(billingCheckouts).values({id,userId,plan,createdAt:new Date().toISOString()}).onConflictDoNothing();}
export async function accountOf(userId:string){return byUser(getDb(),userId);}
export async function markCancelled(userId:string){const now=new Date().toISOString();await getDb().update(billingAccounts).set({cancelledAt:now,updatedAt:now}).where(eq(billingAccounts.userId,userId));}

function repoOf(tx:Tx):BillingRepo{return {
 claim:async e=>(await tx.insert(billingEvents).values({id:e.id,event:e.event,receivedAt:new Date().toISOString()}).onConflictDoNothing().returning({id:billingEvents.id})).length>0,
 userOfCheckout:async id=>(await tx.select({userId:billingCheckouts.userId}).from(billingCheckouts).where(eq(billingCheckouts.id,id)).limit(1))[0]?.userId??null,
 account:userId=>byUser(tx,userId),
 accountBy:async(field,value)=>{const r=(await tx.select().from(billingAccounts).where(eq(field==='subscriptionId'?billingAccounts.subscriptionId:billingAccounts.customerId,value)).limit(1))[0];return r?toAccount(r):null;},
 save:async(userId,patch)=>{await tx.update(billingAccounts).set({...patch,updatedAt:new Date().toISOString()}).where(eq(billingAccounts.userId,userId));},
};}
// Registro do evento e efeito juntos: se algo falhar, nada fica gravado e a AbacatePay tenta de novo.
export async function applyBillingEvent(e:BillingEvent,products:Products){return getDb().transaction(tx=>processEvent(repoOf(tx),e,new Date(),products));}

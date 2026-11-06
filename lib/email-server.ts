// E-mails da conta no servidor: boas-vindas (ao abrir o app e no envio diário) e assinatura confirmada (webhook da AbacatePay).
// Cada envio passa por sendOnce: a linha em email_sends garante um e-mail por pessoa e tipo, mesmo com duas abas ou webhook repetido.
import {and,eq,inArray} from 'drizzle-orm';import {clerkClient} from '@clerk/nextjs/server';import {getDb} from '@/db';import {billingAccounts,emailSends} from '@/db/schema';
import {emailConfig,sendEmail,sendOnce,type SendStore} from './email';import {welcomeEmail,purchaseEmail} from './email-templates';import {profileOf} from './auth';
import {accessOf,isPlan} from './billing';import {accountOf} from './billing-server';import {abacateConfig} from './abacatepay';

const ZONA='America/Sao_Paulo',BOAS_VINDAS='boas-vindas';
const store:SendStore={
 claim:async(userId,kind)=>(await getDb().insert(emailSends).values({userId,kind,sentAt:new Date().toISOString()}).onConflictDoNothing().returning({userId:emailSends.userId})).length>0,
 release:async(userId,kind)=>{await getDb().delete(emailSends).where(and(eq(emailSends.userId,userId),eq(emailSends.kind,kind)));},
};
const log=(o:string)=>(e:unknown)=>{console.error('email:'+o,e instanceof Error?e.message:'erro');return 'failed' as const;};

// Boas-vindas, uma vez por pessoa. trialUntil = fim do teste grátis (só para quem está no teste).
export async function welcomeOnce(p:{userId:string;email:string;name:string;trialUntil:string|null;zone?:string}){
 const cfg=emailConfig();if(!cfg||!p.email)return 'off' as const;
 return sendOnce(store,p.userId,BOAS_VINDAS,()=>sendEmail(cfg,p.email,welcomeEmail({name:p.name,trialUntil:p.trialUntil,zone:p.zone||ZONA}),BOAS_VINDAS+'/'+p.userId)).catch(log('boas-vindas'));}

// Assinatura confirmada: a conta é achada pela assinatura nova (o webhook acabou de gravá-la). Renovação não manda nada.
export async function purchaseOnce(subscriptionId:string){
 const cfg=emailConfig();if(!cfg)return 'off' as const;
 try{const a=(await getDb().select().from(billingAccounts).where(eq(billingAccounts.subscriptionId,subscriptionId)).limit(1))[0];if(!a)return 'unknown' as const;
  const u=profileOf(await (await clerkClient()).users.getUser(a.userId)),kind='compra:'+subscriptionId;
  return await sendOnce(store,a.userId,kind,()=>sendEmail(cfg,u.email,purchaseEmail({name:u.name,plan:isPlan(a.plan)?a.plan:null,until:a.paidUntil,zone:ZONA}),kind));}
 catch(e){return log('compra')(e);}}

const espera=(ms:number)=>new Promise(r=>setTimeout(r,ms));

// Envio diário: quem tem conta no Clerk e ainda não recebeu as boas-vindas (contas antigas e quem nunca abriu o app).
// Até `limite` por dia, um a cada 600 ms (o Resend aceita 2 por segundo; o plano grátis, 100 por dia).
// Não cria conta de cobrança: o teste só começa quando a pessoa abre o app.
export async function welcomeSweep(limite=40){
 const cfg=emailConfig();if(!cfg)return {pendentes:0,enviados:0,falhas:0};
 const clerk=await clerkClient(),users=[];
 for(let offset=0;;offset+=100){const r=await clerk.users.getUserList({limit:100,offset,orderBy:'+created_at'});users.push(...r.data);if(r.data.length<100)break;}
 const ids=users.map(u=>u.id);if(!ids.length)return {pendentes:0,enviados:0,falhas:0};
 const feitos=new Set((await getDb().select({userId:emailSends.userId}).from(emailSends).where(and(eq(emailSends.kind,BOAS_VINDAS),inArray(emailSends.userId,ids)))).map(r=>r.userId));
 const pendentes=users.filter(u=>!feitos.has(u.id));let enviados=0,falhas=0;const cobranca=!!abacateConfig(),agora=new Date();
 for(const user of pendentes.slice(0,limite)){const u=profileOf(user);
  const conta=cobranca?await accountOf(u.userId).catch(()=>null):null,view=conta?accessOf(conta,agora):null;
  const r=await welcomeOnce({...u,trialUntil:view?.status==='trial'?view.until:null});
  if(r==='sent')enviados++;else if(r==='failed')falhas++;
  await espera(600);}
 return {pendentes:pendentes.length,enviados,falhas};}

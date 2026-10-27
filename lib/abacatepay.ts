// Cliente da API v2 da AbacatePay, verificação dos webhooks e leitura tolerante dos eventos (só os campos usados, como a documentação recomenda).
import {createHmac,timingSafeEqual} from 'node:crypto';
import type {BillingEvent,Plan,Products} from './billing.ts';

export const ABACATE_API='https://api.abacatepay.com/v2';
// Chave pública com que a AbacatePay assina o corpo de cada webhook (docs: Webhooks → Segurança). Não é segredo: quem prova a origem é o webhookSecret da URL.
export const ABACATE_PUBLIC_KEY='t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';
export type AbacateConfig={apiKey:string;webhookSecret:string;products:Products};
// Sem as 4 variáveis a cobrança fica desligada e ninguém é bloqueado.
export function abacateConfig(env:Record<string,string|undefined>=process.env):AbacateConfig|null{const v=(k:string)=>env[k]?.trim()||'';const apiKey=v('ABACATEPAY_API_KEY'),webhookSecret=v('ABACATEPAY_WEBHOOK_SECRET'),monthly=v('ABACATEPAY_PRODUCT_MONTHLY'),annual=v('ABACATEPAY_PRODUCT_ANNUAL');return apiKey&&webhookSecret&&monthly&&annual?{apiKey,webhookSecret,products:{monthly,annual}}:null;}

const same=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export const signBody=(raw:string)=>createHmac('sha256',ABACATE_PUBLIC_KEY).update(Buffer.from(raw,'utf8')).digest('base64');
export function verifyWebhook(raw:string,signature:string|null,querySecret:string|null,secret:string){return !!querySecret&&!!signature&&same(querySecret,secret)&&same(signBody(raw),signature);}

const str=(v:unknown)=>typeof v==='string'&&v?v:null;
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
// Sem id no envelope, o evento ganha um id estável pelo checkout ou pela assinatura, para as retentativas continuarem idempotentes.
export function readEvent(raw:unknown):BillingEvent|null{const r=obj(raw),event=str(r.event);if(!event)return null;
 const d=obj(r.data),s=obj(d.subscription),c=obj(d.checkout),items=Array.isArray(c.items)?c.items:[];
 const subscriptionId=str(s.id),checkoutId=str(c.id),key=checkoutId||subscriptionId,id=str(r.id)??(key?event+':'+key:null);if(!id)return null;
 return {id,event,devMode:r.devMode===true,subscriptionId,customerId:str(obj(d.customer).id)??str(c.customerId),checkoutId,frequency:str(s.frequency),productId:str(obj(items[0]).id)};}

export function subscriptionBody(plan:Plan,products:Products,userId:string,origin:string){return {items:[{id:products[plan],quantity:1}],methods:['CARD'],metadata:{userId,plan},returnUrl:origin+'/',completionUrl:origin+'/?assinatura=ok',retryPolicy:{maxRetry:3,retryEvery:1}};}

export type AbacateProduct={id:string;name:string;price:number;cycle:string|null};
export function abacateApi(apiKey:string,fetcher:typeof fetch=fetch){
 // Respostas vêm no envelope {data,success,error}; qualquer outra coisa vira erro com o status e a mensagem da API.
 async function call<T>(path:string,body?:unknown):Promise<T>{const r=await fetcher(ABACATE_API+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  const j=obj(await r.json().catch(()=>null));if(!r.ok||j.success!==true||!j.data)throw new Error('AbacatePay '+r.status+(str(j.error)?': '+j.error:''));return j.data as T;}
 return {
  product:(id:string)=>call<AbacateProduct>('/products/get?id='+encodeURIComponent(id)),
  createSubscription:(body:ReturnType<typeof subscriptionBody>)=>call<{id:string;url:string}>('/subscriptions/create',body),
  cancelSubscription:(id:string)=>call<{id:string;status:string}>('/subscriptions/cancel',{id}),
 };}

import {LEGAL} from './legal.ts';import type {Mensagem} from './email-templates.ts';

// Envio de e-mail pelo Resend (instalado pela loja da Vercel, que cria RESEND_API_KEY). Sem a chave, nada é enviado.
// A API é chamada direto (sem SDK). O Idempotency-Key faz o Resend ignorar um segundo envio igual por 24 h.
// EMAIL_SOMENTE (endereços separados por vírgula) é a trava do teste no ar: enquanto existir, só esses endereços recebem.
// Quem fica de fora não é marcado como enviado, então recebe quando a trava sair.
export type EmailConfig={apiKey:string;from:string;replyTo:string;somente:string[]|null};
type Env=Record<string,string|undefined>;

export function emailConfig(env:Env=process.env):EmailConfig|null{const apiKey=env.RESEND_API_KEY?.trim();if(!apiKey)return null;
 const somente=(env.EMAIL_SOMENTE||'').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);
 return {apiKey,from:env.EMAIL_FROM?.trim()||'GeoAI <contato@geochat.ia.br>',replyTo:LEGAL.email,somente:somente.length?somente:null};}
export const permitido=(cfg:EmailConfig,to:string)=>!cfg.somente||cfg.somente.includes(to.trim().toLowerCase());

export function resendBody(cfg:EmailConfig,to:string,m:Mensagem){return {from:cfg.from,to:[to],reply_to:cfg.replyTo,subject:m.subject,html:m.html,text:m.text};}

export async function sendEmail(cfg:EmailConfig,to:string,m:Mensagem,idempotencyKey:string,f:typeof fetch=fetch){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))throw new Error('e-mail inválido');
 const r=await f('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+cfg.apiKey,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(resendBody(cfg,to,m))});
 const j=await r.json().catch(()=>null) as {id?:string;message?:string}|null;
 if(!r.ok)throw new Error('Resend '+r.status+(j?.message?': '+j.message:''));
 return j?.id;}

// Uma vez só por pessoa e tipo: reserva a linha (email_sends) antes de enviar; se o envio falhar, libera para tentar de novo depois.
export type SendStore={claim(userId:string,kind:string):Promise<boolean>;release(userId:string,kind:string):Promise<void>};
export async function sendOnce(store:SendStore,userId:string,kind:string,send:()=>Promise<unknown>):Promise<'sent'|'skipped'>{
 if(!await store.claim(userId,kind))return 'skipped';
 try{await send();return 'sent';}catch(e){await store.release(userId,kind).catch(()=>{});throw e;}}

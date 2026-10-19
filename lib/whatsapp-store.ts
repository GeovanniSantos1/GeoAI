import {eq,or,lt,and} from 'drizzle-orm';import {getDb} from '@/db';import {whatsappLinks,whatsappCodes} from '@/db/schema';import {newLinkCode,choicesJson} from './whatsapp';import type {HistoryEntry,Pending} from './telegram';
// choices fica como o texto gravado (lido com choicesOf), para as trocas condicionais compararem com o valor lido.
export type WhatsappLink={jid:string;userId:string;label:string;history:HistoryEntry[];pending:Pending;choices:string;recentIds:string[];linkedAt:string};
const CODE_TTL=15*60*1000;
const parse=<T,>(text:string,fallback:T):T=>{try{return JSON.parse(text) as T;}catch{return fallback;}};
const toLink=(row:typeof whatsappLinks.$inferSelect|undefined):WhatsappLink|null=>row?{jid:row.jid,userId:row.userId,label:row.label,history:parse(row.history,[]),pending:parse(row.pending,{}),choices:row.choices,recentIds:parse(row.recentIds,[]),linkedAt:row.linkedAt}:null;
export async function createWaCode(userId:string){const db=getDb(),now=new Date();await db.delete(whatsappCodes).where(or(eq(whatsappCodes.userId,userId),lt(whatsappCodes.expiresAt,now.toISOString())));const code=newLinkCode();await db.insert(whatsappCodes).values({code,userId,expiresAt:new Date(now.getTime()+CODE_TTL).toISOString()});return code;}
// Uso único: o código é apagado na leitura, mesmo se já tiver expirado.
export async function consumeWaCode(code:string){const rows=await getDb().delete(whatsappCodes).where(eq(whatsappCodes.code,code)).returning();const row=rows[0];return row&&row.expiresAt>new Date().toISOString()?row.userId:null;}
export async function linkWhatsapp(userId:string,jid:string,label:string,messageId:string){const db=getDb();await db.delete(whatsappLinks).where(or(eq(whatsappLinks.userId,userId),eq(whatsappLinks.jid,jid)));await db.insert(whatsappLinks).values({jid,userId,label,recentIds:JSON.stringify([messageId]),linkedAt:new Date().toISOString()});}
export async function getWaLinkByJid(jid:string){return toLink((await getDb().select().from(whatsappLinks).where(eq(whatsappLinks.jid,jid)).limit(1))[0]);}
export async function getWaLinkByUser(userId:string){return toLink((await getDb().select().from(whatsappLinks).where(eq(whatsappLinks.userId,userId)).limit(1))[0]);}
export async function unlinkWaJid(jid:string){await getDb().delete(whatsappLinks).where(eq(whatsappLinks.jid,jid));}
export async function unlinkWaUser(userId:string){await getDb().delete(whatsappLinks).where(eq(whatsappLinks.userId,userId));}
// A Evolution reenvia eventos em falha ou demora: cada id de mensagem é processado uma vez (troca condicional da lista recente).
// Devolve a ligação como ficou no claim (history, pending e choices atuais), ou null se o id já foi processado.
export async function claimWaMessage(link:WhatsappLink,id:string){let recent=link.recentIds;
 for(let attempt=0;attempt<5;attempt++){if(recent.includes(id))return null;const rows=await getDb().update(whatsappLinks).set({recentIds:JSON.stringify([...recent,id].slice(-20))}).where(and(eq(whatsappLinks.jid,link.jid),eq(whatsappLinks.recentIds,JSON.stringify(recent)))).returning();if(rows.length)return toLink(rows[0]);
  const fresh=await getWaLinkByJid(link.jid);if(!fresh)return null;recent=fresh.recentIds;}
 return null;}
// pending e choices só entram na gravação quando informados: um turno sem propostas não pode sobrescrever o que mudou durante a chamada à IA.
export async function saveWaConversation(jid:string,history:HistoryEntry[],pending?:Pending,choices?:string[]){await getDb().update(whatsappLinks).set({history:JSON.stringify(history),...(pending?{pending:JSON.stringify(pending)}:{}),...(choices?{choices:choicesJson(choices)}:{})}).where(eq(whatsappLinks.jid,jid));}
export async function setWaChoices(jid:string,choices:string[]){await getDb().update(whatsappLinks).set({choices:choicesJson(choices)}).where(eq(whatsappLinks.jid,jid));}
// Troca condicional: só grava se a coluna ainda tiver o valor lido. Assim um "1" usa as escolhas uma vez e a limpeza não apaga um lembrete novo.
export async function swapWaChoices(jid:string,from:string,to:string){return (await getDb().update(whatsappLinks).set({choices:to}).where(and(eq(whatsappLinks.jid,jid),eq(whatsappLinks.choices,from))).returning({jid:whatsappLinks.jid})).length>0;}
export async function listWaLinks(){return (await getDb().select({jid:whatsappLinks.jid,userId:whatsappLinks.userId}).from(whatsappLinks)).map(r=>({chatId:'wa:'+r.jid,userId:r.userId}));}

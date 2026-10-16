import {eq,and,lt,or} from 'drizzle-orm';import {getDb} from '@/db';import {telegramLinks,telegramCodes} from '@/db/schema';import {newCode,type HistoryEntry,type Pending} from './telegram';
export type TelegramLink={chatId:string;userId:string;label:string;history:HistoryEntry[];pending:Pending;linkedAt:string};
const CODE_TTL=15*60*1000;
const parse=<T,>(text:string,fallback:T):T=>{try{return JSON.parse(text) as T;}catch{return fallback;}};
const toLink=(row:typeof telegramLinks.$inferSelect|undefined):TelegramLink|null=>row?{chatId:row.chatId,userId:row.userId,label:row.label,history:parse(row.history,[]),pending:parse(row.pending,{}),linkedAt:row.linkedAt}:null;
export async function createCode(userId:string){const db=getDb(),now=new Date();await db.delete(telegramCodes).where(or(eq(telegramCodes.userId,userId),lt(telegramCodes.expiresAt,now.toISOString())));const code=newCode();await db.insert(telegramCodes).values({code,userId,expiresAt:new Date(now.getTime()+CODE_TTL).toISOString()});return code;}
// Uso único: o código é apagado na leitura, mesmo se já tiver expirado.
export async function consumeCode(code:string){const rows=await getDb().delete(telegramCodes).where(eq(telegramCodes.code,code)).returning();const row=rows[0];return row&&row.expiresAt>new Date().toISOString()?row.userId:null;}
export async function linkChat(userId:string,chatId:string,label:string,updateId:number){const db=getDb();await db.delete(telegramLinks).where(or(eq(telegramLinks.userId,userId),eq(telegramLinks.chatId,chatId)));await db.insert(telegramLinks).values({chatId,userId,label,lastUpdateId:updateId,linkedAt:new Date().toISOString()});}
export async function getLinkByChat(chatId:string){return toLink((await getDb().select().from(telegramLinks).where(eq(telegramLinks.chatId,chatId)).limit(1))[0]);}
export async function getLinkByUser(userId:string){return toLink((await getDb().select().from(telegramLinks).where(eq(telegramLinks.userId,userId)).limit(1))[0]);}
export async function unlinkChat(chatId:string){await getDb().delete(telegramLinks).where(eq(telegramLinks.chatId,chatId));}
export async function unlinkUser(userId:string){await getDb().delete(telegramLinks).where(eq(telegramLinks.userId,userId));}
// O Telegram reenvia a atualização quando não recebe resposta a tempo; só a primeira entrega é processada.
export async function claimUpdate(chatId:string,updateId:number){return (await getDb().update(telegramLinks).set({lastUpdateId:updateId}).where(and(eq(telegramLinks.chatId,chatId),lt(telegramLinks.lastUpdateId,updateId))).returning({chatId:telegramLinks.chatId})).length>0;}
export async function saveConversation(chatId:string,history:HistoryEntry[],pending:Pending){await getDb().update(telegramLinks).set({history:JSON.stringify(history),pending:JSON.stringify(pending)}).where(eq(telegramLinks.chatId,chatId));}

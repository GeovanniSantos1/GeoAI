import {sql} from 'drizzle-orm';import {getDb} from '@/db';import {usageCounters} from '@/db/schema';
export const QUOTAS={exam_upload:20,exam_review:40,voice:50,fatura_ai:20} as const;
// Conta um uso do dia e devolve false quando o limite já foi atingido; o incremento condicional evita corrida entre abas.
export async function consumeQuota(userId:string,kind:keyof typeof QUOTAS,day:string){const rows=await getDb().insert(usageCounters).values({userId,kind,day,count:1}).onConflictDoUpdate({target:[usageCounters.userId,usageCounters.kind,usageCounters.day],set:{count:sql`${usageCounters.count} + 1`},setWhere:sql`${usageCounters.count} < ${QUOTAS[kind]}`}).returning({count:usageCounters.count});return rows.length>0;}

import {and,eq,desc,inArray,gte} from 'drizzle-orm';import {getDb} from '@/db';import {boardCards,boardEvents,boardAudit,dayPlans} from '@/db/schema';
import {StoreConflict,type BoardStore,type BoardBackup} from './board-store';import type {Card,BoardEvent,AuditEntry} from './board';import type {DayPlan} from './day-plan';
// Quadro do Foco no Postgres: toda consulta filtra por user_id.
type CardRow=typeof boardCards.$inferSelect;
const toRow=(userId:string,c:Card)=>({id:c.id,userId,number:c.number,title:c.title,description:c.description,status:c.status,priority:c.priority,area:c.area,clientId:c.clientId,dueDate:c.dueDate,estimate:c.estimate,tags:JSON.stringify(c.tags),acceptance:JSON.stringify(c.acceptance),subtasks:JSON.stringify(c.subtasks),tests:JSON.stringify(c.tests),testSeq:c.testSeq,proposals:JSON.stringify(c.proposals),rev:c.rev,createdAt:c.createdAt,updatedAt:c.updatedAt,statusChangedAt:c.statusChangedAt});
const fromRow=(r:CardRow):Card=>({id:r.id,number:r.number,title:r.title,description:r.description,status:r.status as Card['status'],priority:r.priority as Card['priority'],area:r.area as Card['area'],clientId:r.clientId,dueDate:r.dueDate,estimate:r.estimate,tags:JSON.parse(r.tags),acceptance:JSON.parse(r.acceptance),subtasks:JSON.parse(r.subtasks),tests:JSON.parse(r.tests),testSeq:r.testSeq,proposals:JSON.parse(r.proposals),rev:r.rev,createdAt:r.createdAt,updatedAt:r.updatedAt,statusChangedAt:r.statusChangedAt});
const fromEvent=(r:typeof boardEvents.$inferSelect):BoardEvent=>({id:r.id,cardId:r.cardId,at:r.at,actor:r.actor as BoardEvent['actor'],kind:r.kind as BoardEvent['kind'],field:r.field,before:r.before,after:r.after});
const auditRow=(userId:string,a:AuditEntry)=>({id:a.id,userId,at:a.at,tool:a.tool,changes:JSON.stringify(a.changes)});
// O driver às vezes embrulha o erro do Postgres; 23505 é violação de unicidade (número ou id repetido).
const isUnique=(e:unknown)=>{const x=e as {code?:string;cause?:{code?:string}};return x?.code==='23505'||x?.cause?.code==='23505';};
// Lotes abaixo do limite de 65.535 parâmetros por comando do Postgres.
const chunks=<T>(rows:T[],n:number)=>Array.from({length:Math.ceil(rows.length/n)},(_,i)=>rows.slice(i*n,i*n+n));
type Tx=Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
async function wipe(tx:Tx,userId:string){await tx.delete(boardCards).where(eq(boardCards.userId,userId));await tx.delete(boardEvents).where(eq(boardEvents.userId,userId));await tx.delete(boardAudit).where(eq(boardAudit.userId,userId));await tx.delete(dayPlans).where(eq(dayPlans.userId,userId));}
export const dbBoardStore:BoardStore={
 async cards(userId){return (await getDb().select().from(boardCards).where(eq(boardCards.userId,userId))).map(fromRow);},
 async card(userId,id){const r=await getDb().select().from(boardCards).where(and(eq(boardCards.userId,userId),eq(boardCards.id,id))).limit(1);return r[0]?fromRow(r[0]):null;},
 async save(userId,{created=[],updated=[],events=[],audit=null}){try{await getDb().transaction(async tx=>{
   for(const c of updated){const r=await tx.update(boardCards).set(toRow(userId,c)).where(and(eq(boardCards.userId,userId),eq(boardCards.id,c.id),eq(boardCards.rev,c.rev-1))).returning({id:boardCards.id});if(!r.length)throw new StoreConflict();}
   for(const part of chunks(created,500))await tx.insert(boardCards).values(part.map(c=>toRow(userId,c)));
   for(const part of chunks(events,1000))await tx.insert(boardEvents).values(part.map(e=>({...e,userId})));
   if(audit)await tx.insert(boardAudit).values(auditRow(userId,audit));});}
  catch(e){if(e instanceof StoreConflict||isUnique(e))throw new StoreConflict();throw e;}},
 async setProposals(userId,id,proposals){const r=await getDb().update(boardCards).set({proposals:JSON.stringify(proposals)}).where(and(eq(boardCards.userId,userId),eq(boardCards.id,id))).returning({id:boardCards.id});return r.length>0;},
 async remove(userId,id){return getDb().transaction(async tx=>{const r=await tx.delete(boardCards).where(and(eq(boardCards.userId,userId),eq(boardCards.id,id))).returning({id:boardCards.id});if(!r.length)return false;await tx.delete(boardEvents).where(and(eq(boardEvents.userId,userId),eq(boardEvents.cardId,id)));return true;});},
 async events(userId,cardId,limit){return (await getDb().select().from(boardEvents).where(and(eq(boardEvents.userId,userId),eq(boardEvents.cardId,cardId))).orderBy(desc(boardEvents.at)).limit(limit)).map(fromEvent);},
 async eventsOf(userId,cardIds){const out:BoardEvent[]=[];for(const part of chunks(cardIds,500))out.push(...(await getDb().select().from(boardEvents).where(and(eq(boardEvents.userId,userId),inArray(boardEvents.cardId,part)))).map(fromEvent));return out;},
 async audit(userId,limit){return (await getDb().select().from(boardAudit).where(eq(boardAudit.userId,userId)).orderBy(desc(boardAudit.at)).limit(limit)).map(r=>({id:r.id,at:r.at,tool:r.tool as AuditEntry['tool'],changes:JSON.parse(r.changes)}));},
 async plan(userId,date){const r=await getDb().select().from(dayPlans).where(and(eq(dayPlans.userId,userId),eq(dayPlans.date,date))).limit(1);return r[0]?JSON.parse(r[0].data) as DayPlan:null;},
 async putPlan(userId,date,plan){const data=JSON.stringify(plan);await getDb().insert(dayPlans).values({userId,date,data}).onConflictDoUpdate({target:[dayPlans.userId,dayPlans.date],set:{data}});},
 async plans(userId,since){return (await getDb().select().from(dayPlans).where(and(eq(dayPlans.userId,userId),gte(dayPlans.date,since)))).map(r=>({date:r.date,data:JSON.parse(r.data) as DayPlan}));},
 async restore(userId,data:BoardBackup,replace){try{await getDb().transaction(async tx=>{if(replace)await wipe(tx,userId);
   for(const part of chunks(data.cards,500))await tx.insert(boardCards).values(part.map(c=>toRow(userId,c)));
   for(const part of chunks(data.events,1000))await tx.insert(boardEvents).values(part.map(e=>({...e,userId}))).onConflictDoNothing();
   for(const part of chunks(data.audit,500))await tx.insert(boardAudit).values(part.map(a=>auditRow(userId,a))).onConflictDoNothing();
   for(const p of data.plans){const plan=JSON.stringify(p.data);await tx.insert(dayPlans).values({userId,date:p.date,data:plan}).onConflictDoUpdate({target:[dayPlans.userId,dayPlans.date],set:{data:plan}});}});}
  catch(e){if(isUnique(e))throw new StoreConflict();throw e;}},
 async clear(userId){await getDb().transaction(tx=>wipe(tx,userId));},
};

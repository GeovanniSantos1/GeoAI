import {and,eq,desc,sql} from 'drizzle-orm';import {getDb} from '@/db';import {gymProfiles,gymActive,gymWorkouts} from '@/db/schema';
import {GymConflict,type GymStore} from './gym-store';import {readProfile} from './gym';import {volumeOf,type ActiveWorkout,type Workout} from './gym-active';import {workoutSets} from './gym-stats';
// Gym no Postgres: toda consulta filtra por user_id; a versão (rev) decide quem grava por cima.
type WorkoutRow=typeof gymWorkouts.$inferSelect;
const now=()=>new Date().toISOString();
const toRow=(userId:string,w:Workout)=>({userId,id:w.id,date:w.date,startedAt:w.startedAt,durationMin:w.durationMin,routineId:w.routineId,name:w.name,volume:Math.round(volumeOf(w)*10),setsDone:workoutSets(w),prs:w.prs,data:JSON.stringify({exercises:w.exercises,notes:w.notes,noProgression:w.noProgression}),rev:w.rev,createdAt:now(),updatedAt:now()});
const fromRow=(r:WorkoutRow):Workout=>{const d=JSON.parse(r.data);return {id:r.id,routineId:r.routineId,name:r.name,date:r.date,startedAt:r.startedAt,durationMin:r.durationMin,notes:d.notes||'',noProgression:d.noProgression===true,exercises:Array.isArray(d.exercises)?d.exercises:[],prs:r.prs,rev:r.rev};};
const isUnique=(e:unknown)=>{const x=e as {code?:string;cause?:{code?:string}};return x?.code==='23505'||x?.cause?.code==='23505';};
const before=(cursor:string)=>{const [date,startedAt,id]=cursor.split('|');return sql`(${gymWorkouts.date},${gymWorkouts.startedAt},${gymWorkouts.id}) < (${date||''},${startedAt||''},${id||''})`;};
// Versão 0 = ainda não existe: insere; senão, atualiza só se a versão do banco for a lida.
async function putDoc(table:typeof gymProfiles|typeof gymActive,userId:string,data:string,rev:number){const db=getDb();
 if(rev===0){try{await db.insert(table).values({userId,data,rev:1,updatedAt:now()});return 1;}catch(e){if(isUnique(e))throw new GymConflict();throw e;}}
 const r=await db.update(table).set({data,rev:rev+1,updatedAt:now()}).where(and(eq(table.userId,userId),eq(table.rev,rev))).returning({rev:table.rev});if(!r.length)throw new GymConflict();return r[0].rev;}
export const dbGymStore:GymStore={
 async profile(userId){const r=await getDb().select().from(gymProfiles).where(eq(gymProfiles.userId,userId)).limit(1);return r[0]?{doc:readProfile(JSON.parse(r[0].data)),rev:r[0].rev}:null;},
 putProfile:(userId,doc,rev)=>putDoc(gymProfiles,userId,JSON.stringify(doc),rev),
 async active(userId){const r=await getDb().select().from(gymActive).where(eq(gymActive.userId,userId)).limit(1);return r[0]?{doc:JSON.parse(r[0].data) as ActiveWorkout,rev:r[0].rev}:null;},
 putActive:(userId,doc,rev)=>putDoc(gymActive,userId,JSON.stringify(doc),rev),
 async dropActive(userId){await getDb().delete(gymActive).where(eq(gymActive.userId,userId));},
 async finish(userId,w,rev){await getDb().transaction(async tx=>{const r=await tx.delete(gymActive).where(and(eq(gymActive.userId,userId),eq(gymActive.rev,rev))).returning({rev:gymActive.rev});if(!r.length)throw new GymConflict();
  await tx.insert(gymWorkouts).values(toRow(userId,w)).onConflictDoNothing();});},
 async workouts(userId,{before:cursor,limit}){const where=cursor?and(eq(gymWorkouts.userId,userId),before(cursor)):eq(gymWorkouts.userId,userId);
  return (await getDb().select().from(gymWorkouts).where(where).orderBy(desc(gymWorkouts.date),desc(gymWorkouts.startedAt),desc(gymWorkouts.id)).limit(limit)).map(fromRow);},
 async workout(userId,id){const r=await getDb().select().from(gymWorkouts).where(and(eq(gymWorkouts.userId,userId),eq(gymWorkouts.id,id))).limit(1);return r[0]?fromRow(r[0]):null;},
 async addWorkout(userId,w){const r=await getDb().insert(gymWorkouts).values(toRow(userId,w)).onConflictDoNothing().returning({id:gymWorkouts.id});return r.length>0;},
 async putWorkout(userId,w){const {createdAt:_c,userId:_u,id:_i,...row}=toRow(userId,w);void _c;void _u;void _i;
  const r=await getDb().update(gymWorkouts).set(row).where(and(eq(gymWorkouts.userId,userId),eq(gymWorkouts.id,w.id),eq(gymWorkouts.rev,w.rev-1))).returning({id:gymWorkouts.id});if(!r.length)throw new GymConflict();},
 async removeWorkout(userId,id){const r=await getDb().delete(gymWorkouts).where(and(eq(gymWorkouts.userId,userId),eq(gymWorkouts.id,id))).returning({id:gymWorkouts.id});return r.length>0;},
 async clear(userId){await getDb().transaction(async tx=>{await tx.delete(gymWorkouts).where(eq(gymWorkouts.userId,userId));await tx.delete(gymActive).where(eq(gymActive.userId,userId));await tx.delete(gymProfiles).where(eq(gymProfiles.userId,userId));});}};

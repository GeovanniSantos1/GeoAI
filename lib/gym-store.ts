import type {GymProfile} from './gym.ts';
import type {ActiveWorkout,Workout} from './gym-active.ts';
// Contrato de gravação do Gym. A versão em memória serve aos testes; a do Postgres fica em gym-db.ts.
export class GymConflict extends Error{constructor(){super('Seu treino mudou em outro aparelho. Tente de novo.');}}
export type Versioned<T>={doc:T;rev:number};
export type Page={before?:string;limit:number};
export type GymStore={
 profile(userId:string):Promise<Versioned<GymProfile>|null>;
 // rev é a versão lida (0 quando ainda não existe); gravar por cima de outra versão dá GymConflict.
 putProfile(userId:string,doc:GymProfile,rev:number):Promise<number>;
 active(userId:string):Promise<Versioned<ActiveWorkout>|null>;
 putActive(userId:string,doc:ActiveWorkout,rev:number):Promise<number>;
 dropActive(userId:string):Promise<void>;
 // Tudo ou nada: grava o treino (sem duplicar pelo id) e apaga o ativo na versão lida.
 finish(userId:string,workout:Workout,activeRev:number):Promise<void>;
 // Do mais novo ao mais antigo; before é o cursor "data|início|id" devolvido pela página anterior.
 workouts(userId:string,page:Page):Promise<Workout[]>;
 workout(userId:string,id:string):Promise<Workout|null>;
 addWorkout(userId:string,workout:Workout):Promise<boolean>;
 // workout.rev já é a versão nova; grava só se a do banco for rev-1.
 putWorkout(userId:string,workout:Workout):Promise<void>;
 removeWorkout(userId:string,id:string):Promise<boolean>;
 clear(userId:string):Promise<void>;
};
export const cursorOf=(w:Pick<Workout,'date'|'startedAt'|'id'>)=>w.date+'|'+w.startedAt+'|'+w.id;
export const byNewest=(a:Workout,b:Workout)=>cursorOf(b).localeCompare(cursorOf(a));
export function memoryGymStore():GymStore{const copy=<T>(v:T):T=>structuredClone(v);
 const profiles=new Map<string,Versioned<GymProfile>>(),actives=new Map<string,Versioned<ActiveWorkout>>(),lists=new Map<string,Map<string,Workout>>();
 const list=(u:string)=>{let m=lists.get(u);if(!m){m=new Map();lists.set(u,m);}return m;};
 return {
  async profile(u){const p=profiles.get(u);return p?copy(p):null;},
  async putProfile(u,doc,rev){if((profiles.get(u)?.rev??0)!==rev)throw new GymConflict();profiles.set(u,{doc:copy(doc),rev:rev+1});return rev+1;},
  async active(u){const a=actives.get(u);return a?copy(a):null;},
  async putActive(u,doc,rev){if((actives.get(u)?.rev??0)!==rev)throw new GymConflict();actives.set(u,{doc:copy(doc),rev:rev+1});return rev+1;},
  async dropActive(u){actives.delete(u);},
  async finish(u,w,rev){if(actives.get(u)?.rev!==rev)throw new GymConflict();if(!list(u).has(w.id))list(u).set(w.id,copy(w));actives.delete(u);},
  async workouts(u,{before,limit}){return [...list(u).values()].sort(byNewest).filter(w=>!before||cursorOf(w)<before).slice(0,limit).map(copy);},
  async workout(u,id){const w=list(u).get(id);return w?copy(w):null;},
  async addWorkout(u,w){if(list(u).has(w.id))return false;list(u).set(w.id,copy(w));return true;},
  async putWorkout(u,w){const cur=list(u).get(w.id);if(!cur||cur.rev!==w.rev-1)throw new GymConflict();list(u).set(w.id,copy(w));},
  async removeWorkout(u,id){return list(u).delete(id);},
  async clear(u){profiles.delete(u);actives.delete(u);lists.delete(u);}};}

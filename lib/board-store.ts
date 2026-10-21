import type {Card,BoardEvent,AuditEntry,Proposals} from './board.ts';
import type {DayPlan} from './day-plan.ts';
// Contrato de gravação do quadro. A versão em memória serve aos testes e à conferência visual; a do Postgres fica em board-db.ts.
export class StoreConflict extends Error{constructor(){super('Conflito de gravação no quadro.');}}
export type BoardWrite={created?:Card[];updated?:Card[];events?:BoardEvent[];audit?:AuditEntry|null};
export type BoardBackup={cards:Card[];events:BoardEvent[];audit:AuditEntry[];plans:{date:string;data:DayPlan}[]};
export type BoardStore={
 cards(userId:string):Promise<Card[]>;
 card(userId:string,id:string):Promise<Card|null>;
 // Tudo ou nada: um card em updated precisa estar no banco com rev-1, e um card em created não pode repetir id nem número; senão StoreConflict.
 save(userId:string,write:BoardWrite):Promise<void>;
 // Propostas da IA não são edição do card: gravam sem mexer na revisão.
 setProposals(userId:string,id:string,proposals:Proposals):Promise<boolean>;
 remove(userId:string,id:string):Promise<boolean>;
 events(userId:string,cardId:string,limit:number):Promise<BoardEvent[]>;
 eventsOf(userId:string,cardIds:string[]):Promise<BoardEvent[]>;
 audit(userId:string,limit:number):Promise<AuditEntry[]>;
 plan(userId:string,date:string):Promise<DayPlan|null>;
 putPlan(userId:string,date:string,plan:DayPlan):Promise<void>;
 plans(userId:string,since:string):Promise<{date:string;data:DayPlan}[]>;
 restore(userId:string,data:BoardBackup,replace:boolean):Promise<void>;
 clear(userId:string):Promise<void>;
};
type Space={cards:Map<string,Card>;events:BoardEvent[];audit:AuditEntry[];plans:Map<string,DayPlan>};
export function memoryBoardStore():BoardStore{const users=new Map<string,Space>();const copy=<T>(v:T):T=>structuredClone(v);
 const u=(id:string)=>{let x=users.get(id);if(!x){x={cards:new Map(),events:[],audit:[],plans:new Map()};users.set(id,x);}return x;};
 const newest=<T extends {at:string}>(a:T,b:T)=>b.at.localeCompare(a.at);
 return {
  async cards(userId){return [...u(userId).cards.values()].map(copy);},
  async card(userId,id){const c=u(userId).cards.get(id);return c?copy(c):null;},
  async save(userId,{created=[],updated=[],events=[],audit=null}){const x=u(userId);
   for(const c of updated){const cur=x.cards.get(c.id);if(!cur||cur.rev!==c.rev-1)throw new StoreConflict();}
   const numbers=new Set([...x.cards.values()].map(c=>c.number));for(const c of created){if(x.cards.has(c.id)||numbers.has(c.number))throw new StoreConflict();numbers.add(c.number);}
   for(const c of [...updated,...created])x.cards.set(c.id,copy(c));x.events.push(...events.map(copy));if(audit)x.audit.push(copy(audit));},
  async setProposals(userId,id,proposals){const c=u(userId).cards.get(id);if(!c)return false;c.proposals=copy(proposals);return true;},
  async remove(userId,id){const x=u(userId);if(!x.cards.delete(id))return false;x.events=x.events.filter(e=>e.cardId!==id);return true;},
  async events(userId,cardId,limit){return u(userId).events.filter(e=>e.cardId===cardId).sort(newest).slice(0,limit).map(copy);},
  async eventsOf(userId,cardIds){const ids=new Set(cardIds);return u(userId).events.filter(e=>ids.has(e.cardId)).map(copy);},
  async audit(userId,limit){return u(userId).audit.slice().sort(newest).slice(0,limit).map(copy);},
  async plan(userId,date){const p=u(userId).plans.get(date);return p?copy(p):null;},
  async putPlan(userId,date,plan){u(userId).plans.set(date,copy(plan));},
  async plans(userId,since){return [...u(userId).plans].filter(([d])=>d>=since).map(([date,data])=>({date,data:copy(data)}));},
  async restore(userId,data,replace){const x=replace?{cards:new Map<string,Card>(),events:[] as BoardEvent[],audit:[] as AuditEntry[],plans:new Map<string,DayPlan>()}:u(userId);
   const numbers=new Set([...x.cards.values()].map(c=>c.number));for(const c of data.cards){if(x.cards.has(c.id)||numbers.has(c.number))throw new StoreConflict();numbers.add(c.number);}
   for(const c of data.cards)x.cards.set(c.id,copy(c));x.events.push(...data.events.map(copy));x.audit.push(...data.audit.map(copy));for(const p of data.plans)x.plans.set(p.date,copy(p.data));users.set(userId,x);},
  async clear(userId){users.delete(userId);}};}

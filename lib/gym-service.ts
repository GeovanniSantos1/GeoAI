// Casos de uso do Gym sobre um GymStore: ler tudo, comandos do plano, do treino em andamento e do histórico.
import {GymError,emptyProfile,applyProfile,isId,type GymProfile,type ProfileCommand} from './gym.ts';
import {applyActive,cleanActive,finishWorkout,cleanWorkout,type ActiveWorkout,type ActiveCommand,type Workout} from './gym-active.ts';
import {isCatalogId} from './gym-catalog.ts';
import {starterPlan} from './gym-plan.ts';
import {GymConflict,cursorOf,type GymStore} from './gym-store.ts';
export type GymDeps={userId:string;store:GymStore;now:()=>Date};
export const PAGE=200;
export type GymView={profile:GymProfile;rev:number;active:ActiveWorkout|null;activeRev:number;workouts:Workout[];next:string|null};
const knownIn=(p:GymProfile)=>(id:string)=>isCatalogId(id)||p.custom.some(c=>c.id===id);
async function profileOf(d:GymDeps){const p=await d.store.profile(d.userId);return p??{doc:emptyProfile(),rev:0};}
export async function workoutPage(d:GymDeps,before?:string){const list=await d.store.workouts(d.userId,{before,limit:PAGE});return {workouts:list,next:list.length===PAGE?cursorOf(list[list.length-1]):null};}
export async function loadGym(d:GymDeps):Promise<GymView>{const [p,a,page]=await Promise.all([profileOf(d),d.store.active(d.userId),workoutPage(d)]);
 return {profile:p.doc,rev:p.rev,active:a?.doc??null,activeRev:a?.rev??0,...page};}
// O instante vem do aparelho (o descanso conta por ele); fora de um dia para trás ou 10 min para a frente, vale o do servidor.
export function instant(d:GymDeps,at:unknown){const now=d.now(),t=typeof at==='string'?Date.parse(at):NaN;return Number.isFinite(t)&&t>=now.getTime()-864e5&&t<=now.getTime()+6e5?new Date(t):now;}
// Comandos do plano valem sobre a versão mais nova; se outro aparelho gravar no meio, tenta de novo.
export async function profileCommand(d:GymDeps,command:ProfileCommand,today:string){
 for(let i=0;i<3;i++){const cur=await profileOf(d);const next=applyProfile(cur.doc,command,{known:isCatalogId,today,starter:starterPlan});
  try{const rev=await d.store.putProfile(d.userId,next,cur.rev);return {profile:next,rev};}catch(e){if(!(e instanceof GymConflict))throw e;}}
 throw new GymError('Seu plano mudou em outro aparelho. Tente de novo.',409);}

export type ActiveRequest={type:'start';workout:unknown;replace?:boolean}|{type:'finish';id:string;prs?:number}|{type:'discard'}|ActiveCommand;
export type ActiveResult={active:ActiveWorkout|null;activeRev:number;workout?:Workout;existing?:boolean};
export async function activeCommand(d:GymDeps,req:ActiveRequest,at:Date):Promise<ActiveResult>{const r=req as any;if(!r||typeof r!=='object')throw new GymError('Comando inválido.');
 const {doc:profile}=await profileOf(d),known=knownIn(profile);
 for(let i=0;i<3;i++){const cur=await d.store.active(d.userId);
  try{
   if(r.type==='start'){
    // Já tem um treino aberto (outro aparelho, aba antiga): devolve o que existe, a não ser que o usuário peça para trocar.
    if(cur&&r.replace!==true)return {active:cur.doc,activeRev:cur.rev,existing:true};
    const fresh=cleanActive(r.workout,known);
    if(cur){await d.store.dropActive(d.userId);}
    const rev=await d.store.putActive(d.userId,fresh,0);return {active:fresh,activeRev:rev};}
   if(r.type==='finish'){
    // Finalizar duas vezes (rede instável) devolve o treino já salvo.
    if(!cur||cur.doc.id!==r.id){const saved=isId(r.id)?await d.store.workout(d.userId,r.id):null;if(saved)return {active:cur?.doc??null,activeRev:cur?.rev??0,workout:saved};throw new GymError('Esse treino já foi fechado ou descartado em outro aparelho.',409);}
    const w=finishWorkout(cur.doc,at,r.prs);await d.store.finish(d.userId,w,cur.rev);return {active:null,activeRev:0,workout:w};}
   if(r.type==='discard'){await d.store.dropActive(d.userId);return {active:null,activeRev:0};}
   if(!cur)throw new GymError('Nenhum treino em andamento. Comece um treino primeiro.',409);
   const next=applyActive(cur.doc,r as ActiveCommand,at,known);const rev=await d.store.putActive(d.userId,next,cur.rev);return {active:next,activeRev:rev};}
  catch(e){if(!(e instanceof GymConflict))throw e;}}
 throw new GymError('Seu treino mudou em outro aparelho. Tente de novo.',409);}

// Histórico: lançar um treino feito no papel, corrigir um salvo, excluir.
export async function addWorkout(d:GymDeps,raw:unknown){const {doc}=await profileOf(d);const w=cleanWorkout(raw,knownIn(doc));w.rev=1;
 if(!await d.store.addWorkout(d.userId,w)){const saved=await d.store.workout(d.userId,w.id);if(saved)return saved;throw new GymError('Não foi possível salvar o treino.');}return w;}
export async function editWorkout(d:GymDeps,id:string,raw:any){if(!isId(id))throw new GymError('Treino não encontrado.',404);const cur=await d.store.workout(d.userId,id);if(!cur)throw new GymError('Treino não encontrado.',404);
 if(!raw||raw.rev!==cur.rev)throw new GymError('Esse treino mudou em outro aparelho. Abra de novo para editar.',409);
 const {doc}=await profileOf(d);const w=cleanWorkout({...raw,id},knownIn(doc));w.rev=cur.rev+1;
 try{await d.store.putWorkout(d.userId,w);}catch(e){if(e instanceof GymConflict)throw new GymError('Esse treino mudou em outro aparelho. Abra de novo para editar.',409);throw e;}return w;}
export async function removeWorkout(d:GymDeps,id:string){if(!isId(id)||!await d.store.removeWorkout(d.userId,id))throw new GymError('Treino não encontrado.',404);return {ok:true};}

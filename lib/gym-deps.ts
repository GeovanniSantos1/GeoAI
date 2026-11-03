import {getUserId} from './auth';import {requireAccess} from './billing-server';import {jsonError,sameOrigin,mutateWorkspace} from './workspace-server';import {dbGymStore} from './gym-db';import {GymError} from './gym';import type {GymDeps} from './gym-service';import type {Workout} from './gym-active';import {workoutSets} from './gym-stats';
// Liga os casos de uso do Gym ao Postgres e à sessão do Clerk.
// Cada treino do Gym vira uma sessão "gym-<id>" do workspace: rende os pontos de treino, conta para a meta de água e aparece para o assistente.
export const sessionOf=(w:Workout)=>({id:'gym-'+w.id,title:w.name,date:w.date,duration:w.durationMin,category:'Gym',notes:workoutSets(w)+' séries no Gym'});
async function syncSession(userId:string,{saved,removed}:{saved?:Workout;removed?:string}){
 if(saved)await mutateWorkspace(userId,'',{type:'upsert',collection:'sessions',item:sessionOf(saved)});
 if(removed)await mutateWorkspace(userId,'',{type:'delete',collection:'sessions',id:'gym-'+removed}).catch(()=>undefined);}
export const gymDeps=(userId:string):GymDeps=>({userId,store:dbGymStore,now:()=>new Date(),sync:change=>syncSession(userId,change)});
export const gymJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function gymFail(error:unknown){
 if(error instanceof GymError)return gymJson({error:error.message},error.status);
 console.error('gym',error instanceof Error?error.message:'erro');return jsonError('Não foi possível concluir agora. Suas séries continuam guardadas neste aparelho.',500);}
// Sessão em tudo; nas gravações, mesma origem e acesso pago em dia (a leitura continua liberada).
export async function gymUser(request:Request,write=true):Promise<{userId:string}|{error:Response}>{const userId=await getUserId();if(!userId)return {error:jsonError('Entre na sua conta para continuar',401)};
 if(write){if(!sameOrigin(request))return {error:jsonError('Origem não permitida',403)};const blocked=await requireAccess(userId);if(blocked)return {error:blocked};}
 return {userId};}
export async function gymBody(request:Request,max=409600):Promise<Record<string,unknown>>{if(!request.headers.get('content-type')?.includes('application/json'))throw new GymError('Formato inválido',415);
 const text=await request.text();if(text.length>max)throw new GymError('Pedido muito grande.',413);let v:unknown;try{v=JSON.parse(text||'{}');}catch{throw new GymError('Pedido inválido.');}
 if(!v||typeof v!=='object'||Array.isArray(v))throw new GymError('Pedido inválido.');return v as Record<string,unknown>;}

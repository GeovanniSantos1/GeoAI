import {getUserId} from './auth';import {loadWorkspace,mutateWorkspace,jsonError,sameOrigin} from './workspace-server';import {consumeQuota} from './quota';import {agentModel} from './agent-runtime';import {boardAi} from './board-ai';import {dbBoardStore} from './board-db';import {BoardError} from './board';import type {BoardDeps} from './board-service';
// Liga os casos de uso do quadro ao Postgres, ao workspace e à IA configurada.
export function boardDeps(userId:string):BoardDeps{return {userId,store:dbBoardStore,load:()=>loadWorkspace(userId,''),mutate:command=>mutateWorkspace(userId,'',command),quota:(kind,day)=>consumeQuota(userId,kind,day),ai:agentModel()?boardAi:null};}
export const boardJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function boardFail(error:unknown){
 if(error instanceof BoardError){const set=(error as BoardError&{set?:unknown}).set;return boardJson({error:error.message,...(set?{set}:{})},error.status);}
 const message=error instanceof Error?error.message:'Não foi possível concluir agora.';if(/outra aba|em andamento/.test(message))return jsonError(message,409);console.error('foco',message);return jsonError(message,400);}
// Sessão do Clerk em tudo; mesma origem nas escritas.
export async function boardUser(request:Request,write=true):Promise<{userId:string}|{error:Response}>{const userId=await getUserId();if(!userId)return {error:jsonError('Entre na sua conta para continuar',401)};if(write&&!sameOrigin(request))return {error:jsonError('Origem não permitida',403)};return {userId};}
export async function readBody(request:Request,max=262144):Promise<Record<string,unknown>>{if(!request.headers.get('content-type')?.includes('application/json'))throw new BoardError('Formato inválido',415);
 const text=await request.text();if(text.length>max)throw new BoardError('Pedido muito grande.',413);let v:unknown;try{v=JSON.parse(text||'{}');}catch{throw new BoardError('Pedido inválido.');}if(!v||typeof v!=='object'||Array.isArray(v))throw new BoardError('Pedido inválido.');return v as Record<string,unknown>;}

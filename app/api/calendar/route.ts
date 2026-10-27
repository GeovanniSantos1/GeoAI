import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {calendarDeps,feedStore} from '@/lib/calendar-server';import {refreshFeed,ensureFresh,calendarPayload} from '@/lib/calendar-sync';import {PROVIDERS,FRESH_MS,type Provider} from '@/lib/external-calendar';import {requireAccess} from '@/lib/billing-server';
export const dynamic='force-dynamic';export const maxDuration=60;
// Agendas externas do usuário logado. GET lê só o banco; POST conecta, força ou completa a sincronização; DELETE desconecta.
const reply=(body:unknown)=>Response.json(body,{headers:{'Cache-Control':'no-store'}});
const providerOf=(value:unknown)=>PROVIDERS.includes(value as Provider)?value as Provider:null;
async function bodyOf(request:Request):Promise<{provider?:unknown;connect?:unknown}>{try{const j=await request.json();return j&&typeof j==='object'?j:{};}catch{return {};}}
const failed=(where:string,e:unknown)=>{console.error(where,e instanceof Error?e.message:'erro');return jsonError('Não foi possível falar com a agenda externa agora.',503);};
export async function GET(){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);const blocked=await requireAccess(userId);if(blocked)return blocked;
 try{return reply(calendarPayload(await feedStore.list(userId)));}catch(e){return failed('calendar:get',e);}}
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);const blocked=await requireAccess(userId);if(blocked)return blocked;
 const body=await bodyOf(request),deps=calendarDeps();
 try{if(body.provider===undefined){await ensureFresh(deps,userId,FRESH_MS);return reply(calendarPayload(await feedStore.list(userId)));}
  const provider=providerOf(body.provider);if(!provider)return jsonError('Agenda não reconhecida');
  // Só "Conectar" ({connect:true}) cria a conta; sem ela, a resposta vem sem result.
  const row=await refreshFeed(deps,userId,provider,body.connect===true),payload=calendarPayload(await feedStore.list(userId));
  return reply(row?{...payload,result:{provider,status:row.status,count:row.events.length}}:payload);}
 catch(e){return failed('calendar:sync',e);}}
export async function DELETE(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 const provider=providerOf((await bodyOf(request)).provider);if(!provider)return jsonError('Agenda não reconhecida');
 try{await feedStore.remove(userId,provider);return reply(calendarPayload(await feedStore.list(userId)));}catch(e){return failed('calendar:delete',e);}}

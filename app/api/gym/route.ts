import {gymDeps,gymJson,gymFail,gymUser,gymBody} from '@/lib/gym-deps';import {loadGym,profileCommand} from '@/lib/gym-service';import {GymError,isDate,type ProfileCommand} from '@/lib/gym';
export const dynamic='force-dynamic';
export async function GET(request:Request){const g=await gymUser(request,false);if('error' in g)return g.error;try{return gymJson(await loadGym(gymDeps(g.userId)));}catch(e){return gymFail(e);}}
// Comandos do plano: rotinas, agenda, ajustes, favoritos e exercícios próprios. today vem do aparelho (fuso do perfil).
export async function POST(request:Request){const g=await gymUser(request);if('error' in g)return g.error;
 try{const body=await gymBody(request);if(!isDate(body.today))throw new GymError('Data do aparelho inválida.');return gymJson(await profileCommand(gymDeps(g.userId),body.command as ProfileCommand,body.today));}catch(e){return gymFail(e);}}

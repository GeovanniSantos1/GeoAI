import {gymDeps,gymJson,gymFail,gymUser,gymBody} from '@/lib/gym-deps';import {importGym} from '@/lib/gym-service';
export const dynamic='force-dynamic';export const maxDuration=60;
// Restauração do backup: até 4 MB por pedaço (abaixo do limite de 4,5 MB da Vercel); a tela divide o histórico antes de enviar.
export async function POST(request:Request){const g=await gymUser(request);if('error' in g)return g.error;
 try{return gymJson(await importGym(gymDeps(g.userId),await gymBody(request,4_000_000)));}catch(e){return gymFail(e);}}

import {gymDeps,gymJson,gymFail,gymUser,gymBody} from '@/lib/gym-deps';import {activeCommand,instant,type ActiveRequest} from '@/lib/gym-service';
export const dynamic='force-dynamic';
// Treino em andamento: começar, cada série, descanso, finalizar, descartar. at é o instante do aparelho.
export async function POST(request:Request){const g=await gymUser(request);if('error' in g)return g.error;
 try{const d=gymDeps(g.userId),body=await gymBody(request);return gymJson(await activeCommand(d,body.command as ActiveRequest,instant(d,body.at)));}catch(e){return gymFail(e);}}

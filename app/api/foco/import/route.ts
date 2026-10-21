import {boardDeps,boardJson,boardFail,boardUser,readBody} from '@/lib/board-deps';import {importBoard} from '@/lib/board-service';
export const dynamic='force-dynamic';export const maxDuration=60;
// Até 4 MB por pedaço, abaixo do limite de 4,5 MB da Vercel; a tela divide o quadro antes de enviar.
export async function POST(request:Request){const g=await boardUser(request);if('error' in g)return g.error;try{return boardJson(await importBoard(boardDeps(g.userId),await readBody(request,4_000_000)));}catch(e){return boardFail(e);}}

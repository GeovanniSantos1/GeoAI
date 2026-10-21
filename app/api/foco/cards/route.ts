import {boardDeps,boardJson,boardFail,boardUser,readBody} from '@/lib/board-deps';import {createCards} from '@/lib/board-service';
export const dynamic='force-dynamic';
export async function POST(request:Request){const g=await boardUser(request);if('error' in g)return g.error;
 try{const body=await readBody(request);return boardJson(await createCards(boardDeps(g.userId),body.cards,'you'));}catch(e){return boardFail(e);}}

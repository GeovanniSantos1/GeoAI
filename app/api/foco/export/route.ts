import {boardDeps,boardJson,boardFail,boardUser} from '@/lib/board-deps';import {exportBoard} from '@/lib/board-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){const g=await boardUser(request,false);if('error' in g)return g.error;
 try{return boardJson(await exportBoard(boardDeps(g.userId),Number(new URL(request.url).searchParams.get('after')||'0')));}catch(e){return boardFail(e);}}

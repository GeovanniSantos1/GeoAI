import {boardDeps,boardJson,boardFail,boardUser} from '@/lib/board-deps';import {listBoard} from '@/lib/board-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){const g=await boardUser(request,false);if('error' in g)return g.error;
 try{return boardJson(await listBoard(boardDeps(g.userId),new URL(request.url).searchParams.get('archived')==='1'));}catch(e){return boardFail(e);}}

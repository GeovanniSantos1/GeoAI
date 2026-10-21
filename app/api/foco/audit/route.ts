import {boardDeps,boardJson,boardFail,boardUser} from '@/lib/board-deps';import {listAudit} from '@/lib/board-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){const g=await boardUser(request,false);if('error' in g)return g.error;try{return boardJson(await listAudit(boardDeps(g.userId)));}catch(e){return boardFail(e);}}

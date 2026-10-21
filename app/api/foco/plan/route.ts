import {boardDeps,boardJson,boardFail,boardUser,readBody} from '@/lib/board-deps';import {getPlan,putPlan} from '@/lib/board-service';
export const dynamic='force-dynamic';
export async function GET(request:Request){const g=await boardUser(request,false);if('error' in g)return g.error;try{return boardJson(await getPlan(boardDeps(g.userId),new URL(request.url).searchParams.get('date')));}catch(e){return boardFail(e);}}
export async function PUT(request:Request){const g=await boardUser(request);if('error' in g)return g.error;try{return boardJson(await putPlan(boardDeps(g.userId),new URL(request.url).searchParams.get('date')||'',await readBody(request)));}catch(e){return boardFail(e);}}

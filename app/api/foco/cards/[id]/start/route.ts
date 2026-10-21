import {boardDeps,boardJson,boardFail,boardUser,readBody} from '@/lib/board-deps';import {startCard} from '@/lib/board-service';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const g=await boardUser(request);if('error' in g)return g.error;
 try{const body=await readBody(request);return boardJson(await startCard(boardDeps(g.userId),(await params).id,{minutes:typeof body.minutes==='number'?body.minutes:undefined,replace:body.replace===true}));}catch(e){return boardFail(e);}}

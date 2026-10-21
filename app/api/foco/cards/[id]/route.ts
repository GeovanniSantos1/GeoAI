import {boardDeps,boardJson,boardFail,boardUser,readBody} from '@/lib/board-deps';import {cardDetail,patchCard,deleteCard} from '@/lib/board-service';
export const dynamic='force-dynamic';
type Ctx={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Ctx){const g=await boardUser(request,false);if('error' in g)return g.error;try{return boardJson(await cardDetail(boardDeps(g.userId),(await params).id));}catch(e){return boardFail(e);}}
export async function PATCH(request:Request,{params}:Ctx){const g=await boardUser(request);if('error' in g)return g.error;try{return boardJson(await patchCard(boardDeps(g.userId),(await params).id,await readBody(request)));}catch(e){return boardFail(e);}}
export async function DELETE(request:Request,{params}:Ctx){const g=await boardUser(request);if('error' in g)return g.error;try{return boardJson(await deleteCard(boardDeps(g.userId),(await params).id));}catch(e){return boardFail(e);}}

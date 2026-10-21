import {boardDeps,boardJson,boardFail,boardUser,readBody} from '@/lib/board-deps';import {generateProposal} from '@/lib/board-service';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){const g=await boardUser(request);if('error' in g)return g.error;
 try{return boardJson(await generateProposal(boardDeps(g.userId),(await params).id,await readBody(request)));}catch(e){return boardFail(e);}}

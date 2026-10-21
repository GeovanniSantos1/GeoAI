import {boardDeps,boardJson,boardFail,boardUser,readBody} from '@/lib/board-deps';import {applyAction} from '@/lib/board-service';import {BoardError} from '@/lib/board';
export const dynamic='force-dynamic';
// Ações aprovadas no painel (ator "approved") e a triagem aplicada pela pessoa (ator "you").
const TOOLS=['mover_cards','arquivar_cards','alterar_cards','criar_cards','aplicar_triagem'];
export async function POST(request:Request){const g=await boardUser(request);if('error' in g)return g.error;
 try{const body=await readBody(request);const tool=body.tool;if(typeof tool!=='string'||!TOOLS.includes(tool))throw new BoardError('Ação desconhecida.');
  return boardJson(await applyAction(boardDeps(g.userId),tool,body.args&&typeof body.args==='object'?body.args as Record<string,unknown>:{},tool==='aplicar_triagem'?'you':'approved'));}catch(e){return boardFail(e);}}

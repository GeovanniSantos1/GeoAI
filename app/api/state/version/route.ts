import {getUserId} from '@/lib/auth';import {loadWorkspace,workspaceVersion,jsonError} from '@/lib/workspace-server';import {isNewer,parseSince} from '@/lib/live-sync';
export const dynamic='force-dynamic';
// Atualização automática do portal: responde só a versão e manda o espaço apenas quando ele mudou desde `since` (WhatsApp, Telegram, lembretes ou outro aparelho).
// Usa auth(), que lê a sessão localmente: diferente do GET /api/state, não consulta a API do Clerk a cada conferência.
export async function GET(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);const since=parseSince(new URL(request.url).searchParams.get('since'));if(since===null)return jsonError('Versão inválida',400);
 try{const version=await workspaceVersion(userId);return Response.json(isNewer(version,since)?await loadWorkspace(userId,''):{version},{headers:{'Cache-Control':'no-store'}});}
 catch(error){console.error('workspace:version',error instanceof Error?error.message:'unknown');return jsonError('Não foi possível conferir seus dados.',503);}}

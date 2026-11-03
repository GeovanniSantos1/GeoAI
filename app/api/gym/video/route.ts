import {gymJson,gymFail,gymUser} from '@/lib/gym-deps';import {dbGymStore} from '@/lib/gym-db';import {dbVideoCache} from '@/lib/gym-video-db';import {videosFor} from '@/lib/gym-video';import {exerciseOf} from '@/lib/gym-catalog';import {consumeQuota} from '@/lib/quota';import {requireAccess} from '@/lib/billing-server';import {GymError,isExerciseId} from '@/lib/gym';
export const dynamic='force-dynamic';
// Vídeos de um exercício. O cache responde de graça; uma busca nova no YouTube gasta 1 da cota diária do usuário (40) e exige o acesso em dia.
export async function GET(request:Request){const g=await gymUser(request,false);if('error' in g)return g.error;
 try{const id=new URL(request.url).searchParams.get('exercise')||'';if(!isExerciseId(id))throw new GymError('Exercício inválido.');
  const custom=(await dbGymStore.profile(g.userId))?.doc.custom||[],e=exerciseOf(id,custom);if(!e)throw new GymError('Exercício não encontrado.',404);
  const day=new Date().toISOString().slice(0,10);
  const result=await videosFor({cache:dbVideoCache,key:process.env.YOUTUBE_API_KEY,now:()=>new Date(),fetch:url=>fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)}),quota:async()=>!await requireAccess(g.userId)&&consumeQuota(g.userId,'gym_video',day)},e);
  return gymJson(result);}catch(e){return gymFail(e);}}

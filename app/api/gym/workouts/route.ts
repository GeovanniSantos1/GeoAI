import {gymDeps,gymJson,gymFail,gymUser,gymBody} from '@/lib/gym-deps';import {workoutPage,addWorkout} from '@/lib/gym-service';
export const dynamic='force-dynamic';
// Histórico em páginas de 200, do mais novo ao mais antigo; ?before= é o cursor da página anterior.
export async function GET(request:Request){const g=await gymUser(request,false);if('error' in g)return g.error;
 try{const before=new URL(request.url).searchParams.get('before')||undefined;return gymJson(await workoutPage(gymDeps(g.userId),before&&before.length<200?before:undefined));}catch(e){return gymFail(e);}}
// Lançar um treino feito no papel.
export async function POST(request:Request){const g=await gymUser(request);if('error' in g)return g.error;
 try{const body=await gymBody(request);return gymJson({workout:await addWorkout(gymDeps(g.userId),body.workout)});}catch(e){return gymFail(e);}}

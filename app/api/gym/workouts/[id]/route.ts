import {gymDeps,gymJson,gymFail,gymUser,gymBody} from '@/lib/gym-deps';import {editWorkout,removeWorkout} from '@/lib/gym-service';
export const dynamic='force-dynamic';
type Ctx={params:Promise<{id:string}>};
// Corrigir um treino salvo (data, séries, cargas); rev é a versão que o aparelho abriu.
export async function PATCH(request:Request,{params}:Ctx){const g=await gymUser(request);if('error' in g)return g.error;
 try{const {id}=await params,body=await gymBody(request);return gymJson({workout:await editWorkout(gymDeps(g.userId),id,body.workout)});}catch(e){return gymFail(e);}}
export async function DELETE(request:Request,{params}:Ctx){const g=await gymUser(request);if('error' in g)return g.error;
 try{const {id}=await params;return gymJson(await removeWorkout(gymDeps(g.userId),id));}catch(e){return gymFail(e);}}

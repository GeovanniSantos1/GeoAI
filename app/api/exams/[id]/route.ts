import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {deleteExam} from '@/lib/exam-service';import {examDeps,examError,examResponse} from '@/lib/exam-deps';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 try{return examResponse(await deleteExam(examDeps(userId),(await params).id));}catch(error){return examError(error);}}

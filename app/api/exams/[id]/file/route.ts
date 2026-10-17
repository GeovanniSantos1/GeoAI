import {getUserId} from '@/lib/auth';import {jsonError} from '@/lib/workspace-server';import {readExamFile} from '@/lib/exam-service';import {examDeps,examError} from '@/lib/exam-deps';
export const dynamic='force-dynamic';
// Só o dono abre o arquivo; o Blob é privado e nunca expõe link público.
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);
 try{const f=await readExamFile(examDeps(userId),(await params).id);return new Response(f.body as BodyInit,{headers:{'Content-Type':f.contentType,'Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(f.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return examError(error);}}

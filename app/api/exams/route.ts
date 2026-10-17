import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {createExamFromFile,createExamManual} from '@/lib/exam-service';import {examDeps,examError,examResponse} from '@/lib/exam-deps';
export const dynamic='force-dynamic';export const maxDuration=60;
// Cria um exame: multipart com o arquivo do laudo, ou JSON vazio para digitar os valores.
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 try{const type=request.headers.get('content-type')||'';
  if(type.includes('application/json'))return examResponse(await createExamManual(examDeps(userId)));
  if(!type.includes('multipart/form-data'))return jsonError('Formato inválido',415);
  if(Number(request.headers.get('content-length')||0)>4.5*1024*1024)return jsonError('Envie um arquivo de até 4 MB.',413);
  const file=(await request.formData()).get('file');if(!(file instanceof File))return jsonError('Escolha um arquivo.',400);
  return examResponse(await createExamFromFile(examDeps(userId),{bytes:new Uint8Array(await file.arrayBuffer()),name:file.name}));}
 catch(error){return examError(error);}}

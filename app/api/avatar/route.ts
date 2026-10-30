import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {requireAccess} from '@/lib/billing-server';import {consumeQuota} from '@/lib/quota';import {todayInZone} from '@/lib/core';import {detectFileType} from '@/lib/testosterone';import {readAvatarPhoto} from '@/lib/avatar-ai';import {lookFromAnalysis} from '@/lib/avatar';
export const dynamic='force-dynamic';export const maxDuration=60;
// Avatar a partir de uma foto: a imagem (já reduzida no aparelho) vai para a IA sem retenção e é descartada; só o visual sugerido volta.
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta para continuar',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);const blocked=await requireAccess(userId);if(blocked)return blocked;
 if(!(request.headers.get('content-type')||'').includes('multipart/form-data'))return jsonError('Formato inválido',415);
 if(Number(request.headers.get('content-length')||0)>4.5*1024*1024)return jsonError('Envie uma foto de até 4 MB.',413);
 let form:FormData;try{form=await request.formData();}catch{return jsonError('Formato inválido',415);}
 const file=form.get('photo'),gender=form.get('gender')==='female'?'female':'male';if(!(file instanceof File))return jsonError('Escolha uma foto.',400);
 const data=new Uint8Array(await file.arrayBuffer()),type=detectFileType(data);if(!type||type==='application/pdf')return jsonError('Envie uma foto em JPG, PNG ou WebP.',415);
 try{if(!await consumeQuota(userId,'avatar_photo',todayInZone()))return jsonError('Você chegou ao limite de fotos de hoje. Tente amanhã.',429);
  const look=lookFromAnalysis(await readAvatarPhoto({data,type}),gender);
  if(!look)return jsonError('Não encontrei um rosto na foto. Tente uma foto de frente, com boa luz.',422);
  return Response.json({look},{headers:{'Cache-Control':'no-store'}});}
 catch(e){const message=e instanceof Error?e.message:'';if(message==='IA não configurada')return jsonError('A criação pela foto não está configurada.',503);console.error('avatar:foto',message);return jsonError('Não consegui ler a foto agora. Tente de novo.',502);}}

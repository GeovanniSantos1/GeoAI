import {getUserId} from '@/lib/auth';import {jsonError,sameOrigin} from '@/lib/workspace-server';import {waSecret,waLink,displayNumber,evolutionErrorText} from '@/lib/whatsapp';import {waContext,ownerJidCached,cachedOwnerJid} from '@/lib/whatsapp-server';import {createWaCode,getWaLinkByUser,unlinkWaUser} from '@/lib/whatsapp-store';
// Vínculo entre a conta do app e uma conversa do WhatsApp, sempre iniciado pelo usuário logado.
export const dynamic='force-dynamic';
export async function GET(){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);const ctx=waContext(),link=await getWaLinkByUser(userId);
 // O cartão não usa o número no GET: ele vem só do cache, sem chamar a Evolution (pode ser null).
 const owner=ctx?cachedOwnerJid(ctx.config.instance):null;
 return Response.json({configured:!!ctx,number:owner?displayNumber(owner):null,linked:link?{label:link.label,linkedAt:link.linkedAt}:null},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 const ctx=waContext();if(!ctx)return jsonError('O WhatsApp não está configurado no servidor.',503);const origin=new URL(request.url).origin;
 try{
  // A instância tem um único webhook: só o domínio de produção o registra, para que uma prévia ou a URL fixa de um deploy antigo não o tire de lá.
  const webhook=process.env.VERCEL_ENV==='production'&&new URL(origin).host===process.env.VERCEL_PROJECT_PRODUCTION_URL;let owner:string;
  try{if(webhook)await ctx.api.setWebhook(origin+'/api/whatsapp',await waSecret(ctx.config.key));owner=await ownerJidCached(ctx.api,ctx.config.instance);}
  catch(e){console.error('whatsapp link',e instanceof Error?e.message:'erro');return jsonError('Não foi possível falar com o WhatsApp: '+evolutionErrorText(e),502);}
  const code=await createWaCode(userId);
  return Response.json({code,url:waLink(owner,code),number:displayNumber(owner),webhook},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('whatsapp link',e instanceof Error?e.message:'erro');return jsonError('Não foi possível gerar o código agora. Tente de novo.',503);}}
export async function DELETE(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);await unlinkWaUser(userId);return Response.json({ok:true});}

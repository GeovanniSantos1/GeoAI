import {getUserId} from '@/lib/auth';import {config} from '@/lib/agent-runtime';import {webhookSecret,telegramApi} from '@/lib/telegram';import {createCode,getLinkByUser,unlinkUser} from '@/lib/telegram-store';import {jsonError,sameOrigin} from '@/lib/workspace-server';
// Vínculo entre a conta do app e um chat do Telegram, sempre iniciado pelo usuário logado.
export async function GET(){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);const link=await getLinkByUser(userId);
 return Response.json({configured:!!config().TELEGRAM_BOT_TOKEN,linked:link?{label:link.label,linkedAt:link.linkedAt}:null},{headers:{'Cache-Control':'no-store'}});}
export async function POST(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);
 const c=config(),token=c.TELEGRAM_BOT_TOKEN;if(!token)return jsonError('O bot do Telegram não está configurado no servidor.',503);
 const api=telegramApi(token,c.TELEGRAM_API_BASE||undefined),origin=new URL(request.url).origin;
 try{
  // O Telegram só aceita webhooks HTTPS; na prévia local o registro é pulado.
  const webhook=origin.startsWith('https://');
  if(webhook)await api('setWebhook',{url:origin+'/api/telegram',secret_token:await webhookSecret(token),allowed_updates:['message','callback_query']});
  const me=await api<{username:string}>('getMe');const code=await createCode(userId);
  return Response.json({url:'https://t.me/'+me.username+'?start='+code,username:me.username,webhook});
 }catch(e){console.error('telegram link',e);return jsonError('Não foi possível falar com o Telegram: '+(e instanceof Error?e.message:'tente novamente'),502);}}
export async function DELETE(request:Request){const userId=await getUserId();if(!userId)return jsonError('Entre na sua conta',401);if(!sameOrigin(request))return jsonError('Origem não permitida',403);await unlinkUser(userId);return Response.json({ok:true});}

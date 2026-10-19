// Lembretes em todos os canais ligados do usuário (Telegram e WhatsApp): agrupa as conversas e envia para cada uma, sem que a falha de um canal impeça o outro.
export function byUser(links:{chatId:string;userId:string}[]){const map=new Map<string,string[]>();for(const l of links){const list=map.get(l.userId)||[];list.push(l.chatId);map.set(l.userId,list);}return map;}
export async function sendToAll<M>(send:(chatId:string,text:string,markup:M)=>Promise<unknown>,chats:string[],text:string,markup:M){let sent=0,failed=0;
 for(const chatId of chats){try{await send(chatId,text,markup);sent++;}catch(e){failed++;console.error('reminder send',chatId.startsWith('wa:')?'whatsapp':'telegram',e instanceof Error?e.message:'erro');}}
 return {sent,failed};}

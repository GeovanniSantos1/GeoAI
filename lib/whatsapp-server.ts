import {evolutionConfig,evolutionApi,waChunks,choicesFrom,type Button} from './whatsapp';import {setWaChoices} from './whatsapp-store';
// Liga a Evolution API às rotas: configuração pelas variáveis de ambiente, cache do número da instância e envio com o prefixo do bot.
type Api=ReturnType<typeof evolutionApi>;
export function waContext(){const config=evolutionConfig(process.env);return config?{config,api:evolutionApi(config)}:null;}
const cache=globalThis as unknown as {geoaiWaOwner?:{instance:string;jid:string;at:number};geoaiWaUnlinked?:Map<string,number>},TTL=5*60*1000;
export function cachedOwnerJid(instance:string){const c=cache.geoaiWaOwner;return c&&c.instance===instance&&Date.now()-c.at<TTL?c.jid:null;}
export async function ownerJidCached(api:Api,instance:string){const hit=cachedOwnerJid(instance);if(hit)return hit;const jid=await api.ownerJid();cache.geoaiWaOwner={instance,jid,at:Date.now()};return jid;}
// Contatos sem ligação no número pessoal: o "não ligado" fica 5 minutos em memória (até 500 conversas), para as mensagens deles não consultarem o banco.
const unlinked=()=>cache.geoaiWaUnlinked??=new Map<string,number>(),key=(instance:string,jid:string)=>instance+' '+jid;
export function knownUnlinked(instance:string,jid:string){const at=unlinked().get(key(instance,jid));return at!==undefined&&Date.now()-at<TTL;}
export function rememberUnlinked(instance:string,jid:string){const m=unlinked(),k=key(instance,jid);m.delete(k);m.set(k,Date.now());if(m.size>500)m.delete(m.keys().next().value as string);}
export function forgetUnlinked(instance:string,jid:string){unlinked().delete(key(instance,jid));}
export async function sayWa(api:Api,jid:string,text:string){for(const part of waChunks(text))await api.sendText(jid,part);}
// Lembrete no WhatsApp: os botões viram "Responda 1 para … · 2 para …" e as escolhas ficam na ligação, gravadas só depois do envio.
export async function sendWaReminder(api:Api,chatId:string,text:string,markup:{inline_keyboard:Button[][]}){const jid=chatId.slice(3),{choices,text:options}=choicesFrom(markup);await sayWa(api,jid,text+'\n\n'+options);await setWaChoices(jid,choices);}

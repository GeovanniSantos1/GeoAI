import {chunkText} from './telegram.ts';
// Peças puras do GeoAI no WhatsApp (Evolution API): leitura dos eventos com as regras do número pessoal, código de ligação,
// opções "1/2" no lugar dos botões do Telegram e o cliente HTTP da Evolution.
export const BOT_PREFIX='🤖 ';
export const WA_LIMIT=4000;
export const CODE_ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
type RawKey={id?:unknown;remoteJid?:unknown;fromMe?:unknown;participant?:unknown};
// Áudio: a chave e a mensagem originais (com os embrulhos) vão de volta para a Evolution baixar o arquivo.
export type WaVoice={seconds?:number;key:RawKey;message:Record<string,unknown>};
export type WaMessage={id:string;jid:string;fromMe:boolean;text:string;label:string;textless:boolean;voice?:WaVoice};
type RawEvent={event?:unknown;instance?:unknown;data?:{key?:RawKey;pushName?:unknown;message?:Record<string,unknown>|null;messageTimestamp?:unknown}};
const isGroup=(jid:string)=>/@(g\.us|broadcast|newsletter)$/.test(jid);
// Efêmeras, de visualização única, documento com legenda e mensagens de outro aparelho embrulham a mensagem em .message.
const WRAPPERS=['ephemeralMessage','viewOnceMessage','viewOnceMessageV2','documentWithCaptionMessage','deviceSentMessage'];
function unwrap(m:unknown){let msg=(m&&typeof m==='object'?m:{}) as Record<string,unknown>;
 for(let depth=0;depth<4;depth++){const inner=WRAPPERS.map(k=>(msg[k] as {message?:unknown}|null|undefined)?.message).find(x=>x&&typeof x==='object');if(!inner)break;msg=inner as Record<string,unknown>;}
 return msg;}
function textOf(m:Record<string,unknown>|null|undefined){if(!m)return '';if(typeof m.conversation==='string')return m.conversation;const e=m.extendedTextMessage as {text?:unknown}|undefined;return typeof e?.text==='string'?e.text:'';}
// Número pessoal: grupos e listas ficam de fora; mensagens do dono só valem na conversa consigo mesmo; o que o bot escreveu (🤖) é ignorado.
// Só mídia de verdade merece a resposta "só texto"; reações, edições, apagamentos e eventos de chave não chegam ao bot.
// Na conversa consigo mesmo, foto e outras mídias são anotações do dono e ficam em silêncio; áudio vai para o assistente, como o texto.
// Sem ownerJid, a mensagem do dono passa com fromMe e quem chama busca o número da instância e lê de novo: assim só ela custa a chamada à Evolution.
// Mensagens com mais de 10 minutos ficam de fora: quando o PC volta, a fila acumulada (inclusive um "1" velho) não é processada.
const MAX_AGE=10*60*1000;
const MEDIA_KEYS=['audioMessage','imageMessage','videoMessage','documentMessage','stickerMessage','locationMessage','contactMessage','contactsArrayMessage','ptvMessage'];
export function parseEvolutionEvent(raw:unknown,instance:string,ownerJid?:string,now=Date.now()):WaMessage|null{
 const e=raw as RawEvent|null;if(!e||typeof e!=='object'||e.event!=='messages.upsert'||e.instance!==instance)return null;
 const ts=Number(e.data?.messageTimestamp);if(ts>0&&now-ts*1000>MAX_AGE)return null;
 const k=e.data?.key;if(!k||typeof k.id!=='string'||!k.id||typeof k.remoteJid!=='string'||!k.remoteJid)return null;
 const jid=k.remoteJid,fromMe=k.fromMe===true;if(isGroup(jid)||k.participant||(fromMe&&ownerJid!==undefined&&jid!==ownerJid))return null;
 const msg=unwrap(e.data?.message),text=textOf(msg).slice(0,4000);if(text.trimStart().startsWith('🤖'))return null;
 const audio=msg.audioMessage&&typeof msg.audioMessage==='object'?msg.audioMessage as {seconds?:unknown}:null,voice=!text.trim()&&audio;
 if(!text.trim()&&!audio&&(fromMe||!MEDIA_KEYS.some(key=>key in msg)))return null;
 const name=typeof e.data?.pushName==='string'?e.data.pushName.trim():'';
 return {id:k.id.slice(0,128),jid,fromMe,text,label:((name?name+' · ':'')+'+'+jid.split('@')[0]).slice(0,120),textless:!text.trim(),
  ...(voice?{voice:{...(typeof voice.seconds==='number'&&voice.seconds>0?{seconds:voice.seconds}:{}),key:k,message:e.data?.message as Record<string,unknown>}}:{})};}
export function linkCodeOf(text:string){const m=/^\s*geoai\s+([a-z0-9]{6})\s*$/i.exec(text);return m?m[1].toUpperCase():null;}
export function newLinkCode(random:(n:number)=>Uint8Array=n=>crypto.getRandomValues(new Uint8Array(n))){return [...random(6)].map(b=>CODE_ALPHABET[b%CODE_ALPHABET.length]).join('');}
export function waCommand(text:string):'ajuda'|'desconectar'|null{const m=/^\s*\/?(ajuda|help|desconectar)\s*$/i.exec(text);if(!m)return null;return m[1].toLowerCase()==='desconectar'?'desconectar':'ajuda';}
export const waLink=(ownerJid:string,code:string)=>'https://wa.me/'+ownerJid.split('@')[0]+'?text='+encodeURIComponent('GEOAI '+code);
export function displayNumber(ownerJid:string){const d=ownerJid.split('@')[0];return d.startsWith('55')&&d.length>=12?'+55 '+d.slice(2,4)+' '+d.slice(4,-4)+'-'+d.slice(-4):'+'+d;}
export type Button={text:string;callback_data:string};
// Os botões do Telegram viram opções numeradas; a ligação guarda as escolhas para a resposta "1" ou "2".
export function choicesFrom(markup:{inline_keyboard:Button[][]}){const buttons=markup.inline_keyboard.flat().slice(0,9);return {choices:buttons.map(b=>b.callback_data),text:'Responda '+buttons.map((b,i)=>(i+1)+' para '+b.text).join(' · ')};}
export function choiceIndex(text:string){const m=/^\s*([1-9])\s*$/.exec(text);return m?Number(m[1])-1:null;}
// As escolhas valem 12 horas: a coluna guarda {"at":"<ISO>","items":[…]}; lista simples (antiga), valor inválido ou vencido contam como sem escolhas.
export const CHOICES_TTL=12*60*60*1000;
export const choicesJson=(items:string[],now=Date.now())=>JSON.stringify({at:new Date(now).toISOString(),items});
export function choicesOf(json:string,now=Date.now()):string[]{try{const c=JSON.parse(json) as {at?:unknown;items?:unknown}|null,items=c?.items,at=typeof c?.at==='string'?Date.parse(c.at):NaN;return Array.isArray(items)&&items.every(i=>typeof i==='string')&&now-at<=CHOICES_TTL?items:[];}catch{return [];}}
// Toda parte começa com o prefixo: uma parte sem ele, na conversa consigo mesmo, seria lida como mensagem do dono.
export const waChunks=(text:string)=>chunkText(text,WA_LIMIT-BOT_PREFIX.length).map(p=>BOT_PREFIX+p);
export async function waSecret(apiKey:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('geoai-whatsapp:'+apiKey));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export type EvolutionConfig={url:string;key:string;instance:string};
export function evolutionConfig(env:Record<string,string|undefined>):EvolutionConfig|null{const url=env.EVOLUTION_API_URL?.trim().replace(/\/+$/,''),key=env.EVOLUTION_API_KEY?.trim(),instance=env.EVOLUTION_INSTANCE?.trim();return url&&key&&instance?{url,key,instance}:null;}
// O fetch avisa tempo esgotado e falha de rede em inglês; o cartão mostra a causa em português.
export function evolutionErrorText(e:unknown){return (e as {name?:unknown}|null)?.name==='TimeoutError'?'A Evolution demorou para responder.':e instanceof TypeError&&/fetch/i.test(e.message)?'Não foi possível alcançar a Evolution. Confira se o computador, a Evolution e o ngrok estão ligados.':e instanceof Error&&e.message?e.message:'tente novamente';}
type Fetch=(url:string,init:RequestInit)=>Promise<Response>;
export function evolutionApi(c:EvolutionConfig,fetcher:Fetch=(url,init)=>fetch(url,init)){
 async function call<T>(method:'GET'|'POST',path:string,body?:unknown):Promise<T>{
  const r=await fetcher(c.url+path,{method,headers:{apikey:c.key,'ngrok-skip-browser-warning':'true',...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('Evolution respondeu '+r.status);return await r.json().catch(()=>null) as T;}
 const inst=encodeURIComponent(c.instance);
 return {
  sendText:(jid:string,text:string)=>call('POST','/message/sendText/'+inst,{number:jid,text}),
  setWebhook:(url:string,secret:string)=>call('POST','/webhook/set/'+inst,{webhook:{enabled:true,url,events:['MESSAGES_UPSERT'],byEvents:false,base64:false,headers:{'x-geoai-secret':secret}}}),
  async ownerJid(){const list=await call<{name?:string;ownerJid?:string}[]|null>('GET','/instance/fetchInstances?instanceName='+inst);const jid=Array.isArray(list)?list.find(x=>x.name===c.instance)?.ownerJid:undefined;if(!jid)throw new Error('Instância não encontrada');return jid;},
  // Com a mensagem completa, a Evolution baixa o áudio do WhatsApp sem procurá-lo no banco dela; o webhook segue sem base64 para as mídias de quem não está ligado.
  async audio(voice:Pick<WaVoice,'key'|'message'>){const r=await call<{base64?:unknown}|null>('POST','/chat/getBase64FromMediaMessage/'+inst,{message:{key:voice.key,message:voice.message},convertToMp4:false});
   if(typeof r?.base64!=='string'||!r.base64)throw new Error('Áudio indisponível na Evolution');return Uint8Array.from(atob(r.base64),ch=>ch.charCodeAt(0));}};}

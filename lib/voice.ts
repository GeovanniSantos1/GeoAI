// Áudio no Telegram e no WhatsApp: escolha do provedor de transcrição e o passo comum aos dois canais (duração, cota, download e transcrição).
// O áudio nunca é guardado; só o texto transcrito segue para o assistente e para o histórico.
export const MAX_VOICE_SECONDS=120;
export const MAX_VOICE_BYTES=10*1024*1024;
export const VOICE_TOO_LONG='Mande áudios de até 2 minutos.';
export const VOICE_LIMIT='Você chegou ao limite de áudios de hoje. Pode escrever sua mensagem.';
export const VOICE_UNCLEAR='Não consegui entender o áudio. Pode repetir ou escrever?';
export const VOICE_FAILED='Não consegui ouvir seu áudio agora. Tente de novo ou escreva sua mensagem.';
export const mediaReply=(voice:boolean)=>voice?'Por enquanto eu entendo mensagens de texto e áudio.':'Por enquanto eu entendo só mensagens de texto.';
export type VoiceProvider={name:'groq'|'openai';apiKey:string;model:string};
// Groq é grátis no plano básico; a OpenAI usa a chave do assistente, mas não um endpoint compatível em AI_BASE_URL, que costuma não ter transcrição.
export function voiceProviders(env:Record<string,string|undefined>):VoiceProvider[]{const groq=env.GROQ_API_KEY?.trim(),openai=env.AI_API_KEY?.trim();
 return [...(groq?[{name:'groq' as const,apiKey:groq,model:'whisper-large-v3-turbo'}]:[]),...(openai&&!env.AI_BASE_URL?.trim()?[{name:'openai' as const,apiKey:openai,model:'gpt-4o-mini-transcribe'}]:[])];}
export async function firstWorking<T>(tries:(()=>Promise<T>)[]):Promise<T>{let last:unknown=new Error('Nenhum provedor de transcrição');
 for(const run of tries){try{return await run();}catch(e){last=e;}}throw last;}
export type HearDeps={quota:()=>Promise<boolean>;download:()=>Promise<Uint8Array>;transcribe:(audio:Uint8Array)=>Promise<string>};
// A duração vem da mensagem e barra o áudio antes de gastar cota e download; o tamanho confere o arquivo baixado.
export async function hearVoice(d:HearDeps,seconds?:number):Promise<{text:string}|{reply:string}>{
 if(seconds!==undefined&&seconds>MAX_VOICE_SECONDS)return {reply:VOICE_TOO_LONG};
 if(!await d.quota())return {reply:VOICE_LIMIT};
 let text:string;try{const audio=await d.download();if(audio.byteLength>MAX_VOICE_BYTES)return {reply:VOICE_TOO_LONG};text=(await d.transcribe(audio)).trim();}
 catch(e){console.error('voice',e instanceof Error?e.message:'erro');return {reply:VOICE_FAILED};}
 return text?{text}:{reply:VOICE_UNCLEAR};}
// Mostra o que foi ouvido antes da resposta, para a pessoa conferir antes de confirmar as sugestões.
export const heardLine=(text:string)=>'🎙️ “'+(text.length>500?text.slice(0,500)+'…':text)+'”';

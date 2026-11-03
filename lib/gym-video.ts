// Vídeos curtos dos exercícios: busca no YouTube (só o nome do exercício vai para o Google), cache compartilhado e o link de busca como reserva.
import type {Exercise} from './gym-catalog.ts';
export type Video={id:string;title:string;channel:string};
export type VideoResult={videos:Video[];source:'cache'|'youtube'|'none';searchUrl:string;reason?:'no-key'|'quota'|'error'|'custom'|'empty'};
export const VIDEO_MAX=5,VIDEO_TTL_DAYS=60;
// Em pt-BR, com "como fazer" para puxar tutoriais; alongamento e cardio pedem outra palavra.
export function videoQuery(e:Pick<Exercise,'name'|'category'>){return e.name+' '+(e.category==='stretching'?'alongamento como fazer':e.category==='cardio'?'como fazer exercício':'como fazer execução correta');}
export const searchUrl=(e:Pick<Exercise,'name'|'category'>)=>'https://www.youtube.com/results?search_query='+encodeURIComponent(videoQuery(e));
export const embedUrl=(id:string)=>'https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?rel=0&modestbranding=1&playsinline=1';
export const watchUrl=(id:string)=>'https://www.youtube.com/watch?v='+encodeURIComponent(id);
export const isVideoId=(v:unknown):v is string=>typeof v==='string'&&/^[\w-]{11}$/.test(v);
const ENTITIES:Record<string,string>={'&amp;':'&','&quot;':'"','&#39;':"'",'&lt;':'<','&gt;':'>'};
const decode=(s:string)=>s.replace(/&(amp|quot|#39|lt|gt);/g,m=>ENTITIES[m]);
// Resposta do search.list: só vídeos com id válido, sem repetir, no máximo VIDEO_MAX.
export function parseSearch(json:unknown):Video[]{const items=json&&typeof json==='object'&&Array.isArray((json as {items?:unknown}).items)?(json as {items:unknown[]}).items:[];const out:Video[]=[];
 for(const it of items){const x=it as {id?:{videoId?:unknown};snippet?:{title?:unknown;channelTitle?:unknown}};const id=x?.id?.videoId;if(!isVideoId(id)||out.some(v=>v.id===id))continue;
  out.push({id,title:decode(String(x.snippet?.title??'')).slice(0,160),channel:decode(String(x.snippet?.channelTitle??'')).slice(0,80)});if(out.length>=VIDEO_MAX)break;}
 return out;}
export const isFresh=(fetchedAt:string,now:Date)=>now.getTime()-Date.parse(fetchedAt)<VIDEO_TTL_DAYS*864e5;
export function searchRequest(e:Pick<Exercise,'name'|'category'>,key:string){const q=new URLSearchParams({part:'snippet',type:'video',maxResults:String(VIDEO_MAX),q:videoQuery(e),relevanceLanguage:'pt',regionCode:'BR',safeSearch:'strict',videoEmbeddable:'true',videoDuration:'short',key});return 'https://www.googleapis.com/youtube/v3/search?'+q.toString();}

export type VideoCache={get(exerciseId:string):Promise<{videos:Video[];fetchedAt:string}|null>;put(exerciseId:string,videos:Video[],fetchedAt:string):Promise<void>};
export type VideoDeps={cache:VideoCache;key?:string;now:()=>Date;fetch:(url:string)=>Promise<{ok:boolean;status:number;json():Promise<unknown>}>;quota:()=>Promise<boolean>};
// Cache primeiro; sem cache fresco, uma busca (que gasta cota do usuário e da chave). Exercício próprio não sai do app: só o link de busca.
export async function videosFor(d:VideoDeps,e:Exercise):Promise<VideoResult>{const link=searchUrl(e);
 if(e.custom)return {videos:[],source:'none',searchUrl:link,reason:'custom'};
 const hit=await d.cache.get(e.id);if(hit&&hit.videos.length&&isFresh(hit.fetchedAt,d.now()))return {videos:hit.videos,source:'cache',searchUrl:link};
 if(!d.key)return hit?.videos.length?{videos:hit.videos,source:'cache',searchUrl:link}:{videos:[],source:'none',searchUrl:link,reason:'no-key'};
 if(!await d.quota())return hit?.videos.length?{videos:hit.videos,source:'cache',searchUrl:link}:{videos:[],source:'none',searchUrl:link,reason:'quota'};
 let res;try{res=await d.fetch(searchRequest(e,d.key));}catch{res=null;}
 // 403 é a cota diária da chave; qualquer falha devolve o cache antigo, se houver, ou o link.
 if(!res||!res.ok){const reason=res?.status===403?'quota':'error';return hit?.videos.length?{videos:hit.videos,source:'cache',searchUrl:link}:{videos:[],source:'none',searchUrl:link,reason};}
 const videos=parseSearch(await res.json().catch(()=>({})));if(!videos.length)return {videos:[],source:'none',searchUrl:link,reason:'empty'};
 await d.cache.put(e.id,videos,d.now().toISOString());return {videos,source:'youtube',searchUrl:link};}
export function memoryVideoCache():VideoCache{const m=new Map<string,{videos:Video[];fetchedAt:string}>();return {async get(id){const v=m.get(id);return v?structuredClone(v):null;},async put(id,videos,fetchedAt){m.set(id,{videos:structuredClone(videos),fetchedAt});}};}

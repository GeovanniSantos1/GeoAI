'use client';
import {useEffect,useState} from 'react';
import {PlayCircle,Repeat,ExternalLink,LoaderCircle,Video} from 'lucide-react';
import {embedUrl,watchUrl,searchUrl,type VideoResult} from '@/lib/gym-video';
import type {Exercise} from '@/lib/gym-catalog';
// Vídeo curto do exercício, do YouTube. Só carrega quando você toca (o player do YouTube não abre sozinho); com auto, já busca ao abrir.
export function ExerciseVideo({exercise,auto=false}:{exercise:Exercise;auto?:boolean}){
 const [state,setState]=useState<'idle'|'loading'|'ready'|'none'>('idle'),[res,setRes]=useState<VideoResult|null>(null),[i,setI]=useState(0);
 const load=async()=>{setState('loading');try{const r=await fetch('/api/gym/video?exercise='+encodeURIComponent(exercise.id),{cache:'no-store'});const j=await r.json() as VideoResult&{error?:string};if(!r.ok)throw new Error(j.error);setRes(j);setI(0);setState(j.videos.length?'ready':'none');}
  catch{setRes({videos:[],source:'none',searchUrl:searchUrl(exercise),reason:'error'});setState('none');}};
 useEffect(()=>{if(!auto)return;const t=setTimeout(load,0);return()=>clearTimeout(t);},[auto,exercise.id]);// eslint-disable-line react-hooks/exhaustive-deps -- busca uma vez por exercício
 if(state==='idle')return <button className="gy-video-start" onClick={load}><PlayCircle size={26}/><span><strong>Ver vídeo tutorial</strong><small>Vídeo curto do YouTube</small></span></button>;
 if(state==='loading')return <div className="gy-video loading" role="status"><LoaderCircle className="spin"/><span>Procurando um vídeo…</span></div>;
 if(state==='none'||!res)return <div className="gy-video-none"><p>{res?.reason==='quota'?'O limite de buscas de vídeo de hoje acabou.':res?.reason==='custom'?'Exercício próprio: procure um vídeo direto no YouTube.':'Não achei um vídeo curto agora.'}</p><a className="button outline small" href={res?.searchUrl||searchUrl(exercise)} target="_blank" rel="noreferrer"><Video size={15}/>Ver vídeos no YouTube</a></div>;
 const v=res.videos[i];
 return <figure className="gy-video-box"><div className="gy-video"><iframe src={embedUrl(v.id)} title={'Vídeo: '+v.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/></div>
  <figcaption><span><strong>{v.title}</strong><small>{v.channel} · YouTube</small></span><span className="gy-video-actions">{res.videos.length>1&&<button className="button ghost small" onClick={()=>setI(x=>(x+1)%res.videos.length)}><Repeat size={14}/>Outro vídeo</button>}<a className="button ghost small" href={watchUrl(v.id)} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Abrir no YouTube</a></span></figcaption>
  <p className="gy-video-note">Vídeo de terceiros, escolhido pela busca do YouTube. Confira a execução com um profissional.</p></figure>;}

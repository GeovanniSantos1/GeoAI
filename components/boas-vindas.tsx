'use client';
import {useEffect,useRef,useState} from 'react';import {Play,VolumeX} from 'lucide-react';import {CAPITULOS,VIDEO} from '@/lib/boas-vindas';

// Vídeo do tutorial na página /obrigado: começa sozinho no mudo (as legendas estão no próprio vídeo),
// "Toque para ouvir" volta ao começo com som, e os capítulos pulam para cada parte, já com som.
// Quem pede menos animação no sistema não vê o vídeo começar sozinho.
export function VideoTutorial(){
 const ref=useRef<HTMLVideoElement>(null);const [som,setSom]=useState(false),[tocando,setTocando]=useState(false),[atual,setAtual]=useState(-1);
 useEffect(()=>{const v=ref.current;if(!v||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  v.muted=true;v.play().catch(()=>{});},[]);
 function ouvir(inicio=0){const v=ref.current;if(!v)return;v.muted=false;v.currentTime=inicio;setSom(true);v.play().catch(()=>{});}
 function parte(t:number){let k=-1;CAPITULOS.forEach((c,i)=>{if(t>=c.inicio)k=i;});setAtual(k);}
 return <section className="welcome-video" aria-label="Vídeo: como conectar o GeoAI">
  <div className="welcome-frame">
   <video ref={ref} src={VIDEO.src} poster={VIDEO.capa} muted playsInline preload="metadata" controls={som} aria-label="Tutorial: conectar o WhatsApp, o Telegram e a agenda"
    onPlay={()=>setTocando(true)} onPause={()=>setTocando(false)} onTimeUpdate={e=>parte(e.currentTarget.currentTime)}/>
   {!som&&<button type="button" className="welcome-sound" onClick={()=>ouvir()}>
    {tocando?<VolumeX size={26} aria-hidden="true"/>:<Play size={26} aria-hidden="true"/>}
    <span>{tocando?'Seu vídeo já começou':'Tutorial em vídeo'}</span><strong>{tocando?'Toque para ouvir':'Toque para assistir'}</strong></button>}
  </div>
  <nav className="welcome-chapters" aria-label="Partes do vídeo">{CAPITULOS.map((c,i)=><button type="button" key={c.rotulo} className={i===atual?'active':undefined} aria-current={i===atual?'step':undefined} onClick={()=>ouvir(c.inicio)}>{c.rotulo}</button>)}</nav>
 </section>;}

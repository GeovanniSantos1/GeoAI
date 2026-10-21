'use client';
import {useEffect,useRef,useState} from 'react';import {Pause,Play,X,ArrowRight} from 'lucide-react';
import {useApp} from './context';import {useSound} from './sound-player';import {Ring,mmss} from './focus-ui';
import {remaining,nextBreak,KIND_LABEL} from '@/lib/focus';import type {FocusTimer} from '@/lib/types';
// Segundos que faltam: o relógio da tela anda de 500 em 500 ms; pausado, vale o que ficou guardado.
export function useRemaining(t:FocusTimer|null){const [now,setNow]=useState(0);
 useEffect(()=>{if(!t||t.pausedLeft!==undefined)return;const tick=()=>setNow(Date.now());const first=setTimeout(tick,0),i=setInterval(tick,500);return()=>{clearTimeout(first);clearInterval(i);};},[t]);
 if(!t)return 0;if(t.pausedLeft!==undefined)return t.pausedLeft;return now?Math.min(t.minutes*60,remaining(t,new Date(now))):t.minutes*60;}
// Três bipes curtos no fim (Web Audio), além do que o menu Músicas já faz.
function beep(){try{const C=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext,ctx=new C();
 for(const at of [0,0.35,0.7]){const o=ctx.createOscillator(),g=ctx.createGain(),t0=ctx.currentTime+at;o.frequency.value=880;g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(0.25,t0+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t0+0.25);o.connect(g).connect(ctx.destination);o.start(t0);o.stop(t0+0.3);}
 setTimeout(()=>ctx.close(),1500);}catch{}}
const TITLE='GeoAI — Seu dia com direção';
const label=(t:FocusTimer)=>t.kind==='focus'?(t.code?'Foco · '+t.code:'Foco livre'):KIND_LABEL[t.kind];
// Pede a aba ao Foco: pelo sessionStorage (Foco fechado) e por evento (Foco aberto).
export function openFocoTab(navigate:(p:string)=>void,tab:string){try{sessionStorage.setItem('geoai-foco-tab',tab);}catch{}window.dispatchEvent(new CustomEvent('geoai:foco-tab',{detail:tab}));navigate('/pomodoro');}
type Ended={kind:FocusTimer['kind'];code?:string;cardId?:string};
// Último card focado nesta aba do navegador: o fim da pausa oferece voltar para ele.
let lastFocusCard:{id:string;code?:string}|null=null;
export function FocusMiniTimer(){const a=useApp(),sound=useSound();const {mutate,navigate,toast,sync,state,today}=a;const t=state.focusTimer,left=useRemaining(t),paused=!!t&&t.pausedLeft!==undefined;
 const [ended,setEnded]=useState<Ended|null>(null);const completing=useRef(''),prev=useRef<{id:string;paused:boolean;focus:boolean}|null>(null);
 // Quem conclui é o servidor; a tela pede quando vê o tempo zerar, inclusive ao abrir o app com o timer já vencido.
 useEffect(()=>{if(!t||t.pausedLeft!==undefined)return;const check=()=>{if(Date.now()<Date.parse(t.endsAt)-1000||completing.current===t.id)return;completing.current=t.id;sound.focusSession('end');beep();
   setEnded(t.kind==='focus'?{kind:t.kind,code:t.code,cardId:t.boardCardId}:{kind:t.kind,code:lastFocusCard?.code,cardId:lastFocusCard?.id});
   mutate({type:'focus',action:'complete'}).then(ok=>{if(!ok)setTimeout(()=>{completing.current='';},10000);});};
  check();const i=setInterval(check,500);return()=>clearInterval(i);},[t,mutate,sound]);
 // Ondas de foco do menu Músicas: começam com o foco e param na pausa ou na interrupção.
 useEffect(()=>{const cur=t?{id:t.id,paused:t.pausedLeft!==undefined,focus:t.kind==='focus'}:null,before=prev.current;prev.current=cur;if(t?.boardCardId)lastFocusCard={id:t.boardCardId,code:t.code};
  if(t&&cur?.focus&&!cur.paused&&(!before||before.id!==cur.id||before.paused))sound.focusSession('start',Date.parse(t.endsAt));
  else if(before?.focus&&!before.paused&&(!cur||cur.id!==before.id||cur.paused)&&completing.current!==before.id)sound.focusSession('pause');},[t,sound]);
 useEffect(()=>{document.title=t?mmss(left)+' · '+(t.code||label(t))+' · GeoAI':TITLE;},[t,left]);
 useEffect(()=>()=>{document.title=TITLE;},[]);
 async function startBreak(){setEnded(null);await mutate({type:'focus',action:'start',kind:nextBreak(state.focusSessions,today)});}
 async function continueCard(id:string){setEnded(null);try{const r=await fetch('/api/foco/cards/'+encodeURIComponent(id)+'/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({replace:true})});const j=await r.json();if(!r.ok)throw new Error(j.error);sync(j);window.dispatchEvent(new Event('geoai:foco-refresh'));}
  catch(e){toast(e instanceof Error&&e.message?e.message:'Não foi possível iniciar o pomodoro.',true);}}
 const announce=ended?(ended.kind==='focus'?'Foco concluído.':'Pausa encerrada.'):t&&!paused?label(t)+': faltam '+Math.ceil(left/60)+' minutos.':'';
 return <>{t&&<button className={'fo-mini'+(paused?' paused':'')} onClick={()=>openFocoTab(navigate,'timer')} aria-label={'Pomodoro: '+mmss(left)+(paused?', pausado':'')}>
   <Ring fraction={left/(t.minutes*60)} size={26} stroke={3} tone={t.kind==='focus'?'var(--fo-tomato)':'var(--green)'}/><b>{mmss(left)}</b><small>{t.code||(t.kind==='focus'?'Livre':'Pausa')}</small>{paused&&<Pause size={12}/>}</button>}
  <span className="fo-sr" aria-live="polite">{announce}</span>
  {ended&&<div className="fo-end" role="dialog" aria-label={ended.kind==='focus'?'Foco concluído':'Pausa encerrada'}><button className="icon-button fo-end-close" aria-label="Fechar" onClick={()=>setEnded(null)}><X size={16}/></button>
   {ended.kind==='focus'?<><b>🍅 Foco concluído!</b><p>{ended.code?'Continuar no '+ended.code+' ou trocar?':'Bom trabalho. Hora de uma pausa?'}</p>
     <div className="fo-end-actions"><button className="button primary small" onClick={startBreak}>Fazer a pausa</button>{ended.cardId&&<button className="button outline small" onClick={()=>continueCard(ended.cardId!)}><Play size={14} fill="currentColor"/>Continuar no {ended.code}</button>}
      <button className="button ghost small" onClick={()=>{setEnded(null);openFocoTab(navigate,'board');}}>Trocar de card</button><button className="button ghost small" onClick={()=>setEnded(null)}>Fechar</button></div></>
   :<><b>☕ Pausa encerrada</b><div className="fo-end-actions">{ended.cardId&&<button className="button primary small" onClick={()=>continueCard(ended.cardId!)}>Voltar para o {ended.code}</button>}<button className="button ghost small" onClick={()=>setEnded(null)}>Fechar</button></div></>}</div>}</>;}
// Cartão de foco do Início: o timer ativo, ou a duração do foco nos ajustes.
export function FocusPreview(){const a=useApp();const t=a.state.focusTimer,left=useRemaining(t),[m,s]=mmss(t?left:a.state.profile.focus.focusMinutes*60).split(':');
 return <><div className="focus-preview">{m}<span>:</span>{s}</div><button className="button cream" onClick={()=>openFocoTab(a.navigate,'timer')}><Play size={15} fill="currentColor"/>{t?'Ver o pomodoro':'Começar a focar'}<ArrowRight size={16}/></button></>;}

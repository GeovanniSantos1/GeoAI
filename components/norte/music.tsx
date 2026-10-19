'use client';
// Menu Músicas: tela com faixas, ondas, mixer e créditos, e o mini-player que fica visível em todas as telas.
import {useState,useEffect} from 'react';import {Headphones,Play,Pause,SkipForward,X} from 'lucide-react';
import {useApp} from './context';import {PageHeading,Tabs} from './primitives';import {useSound} from './sound-player';
import {TRACKS,MOMENTS,MOMENT_ORDER,NOISES,tracksFor,waveLabel,formatDuration,formatClock,nowPlaying} from '@/lib/sounds';import type {Moment} from '@/lib/sounds';
const MOMENT_KEY='norte-music-moment',TIMERS:[string,number|null][]=[['15 min',15],['30 min',30],['60 min',60],['Sem timer',null]];
// Tempo restante do timer; o relógio vive em estado, atualizado por intervalo de 1 s, nunca na renderização.
function useRemaining(endsAt:number|null){const [tick,setTick]=useState<{now:number;at:number|null}>({now:0,at:null});
 useEffect(()=>{if(!endsAt)return;const run=()=>setTick({now:Date.now(),at:endsAt});const first=window.setTimeout(run,0),id=window.setInterval(run,1000);return()=>{clearTimeout(first);clearInterval(id);};},[endsAt]);
 return endsAt&&tick.at===endsAt?formatClock(endsAt-tick.now):null;}
const isMoment=(v:string|null):v is Moment=>!!v&&(MOMENT_ORDER as string[]).includes(v);
export function MusicView(){const s=useSound(),{state}=s;
 const [tab,setTab]=useState<Moment>(()=>{try{const v=sessionStorage.getItem(MOMENT_KEY);sessionStorage.removeItem(MOMENT_KEY);if(isMoment(v))return v;}catch{}return state.moment;});
 const m=tab,left=useRemaining(state.timerEndsAt),wavesHere=state.wavesOn&&state.moment===m&&!state.paused;
 return <><PageHeading eyebrow="RESPIRE, FOQUE, DESCANSE" title="Músicas & ondas" description="Sons para focar, relaxar e dormir enquanto você usa o GeoAI."/>
 <Tabs items={MOMENT_ORDER.map(id=>({id,label:MOMENTS[id].label}))} value={m} onChange={id=>setTab(id as Moment)}/>
 <div className="music-grid">
 <section className="panel music-waves"><h3>{waveLabel(m)}</h3>
 {state.wavesSupported?<><button className="button primary" onClick={()=>s.toggleWaves(m)}>{wavesHere?'Pausar ondas':'Tocar ondas'}</button>
 <div className="noise-picker" role="radiogroup" aria-label="Ruído de fundo">{NOISES.map(n=><button key={n.id} role="radio" aria-checked={state.noise[m]===n.id} className={'noise-pill'+(state.noise[m]===n.id?' active':'')} onClick={()=>s.setNoise(m,n.id)}>{n.label}</button>)}</div>
 <p className="music-note">Use fones de ouvido: as ondas binaurais precisam dos dois lados.</p>
 <p className="music-note">No iPhone, desligue o modo silencioso para ouvir as ondas. Com a tela bloqueada, as ondas podem pausar.</p></>
 :<p className="music-note">Seu navegador não toca as ondas. As músicas funcionam normalmente.</p>}</section>
 <section className="panel music-tracks"><h3>Músicas</h3><div className="track-list">{tracksFor(m).map(t=>{const on=state.trackId===t.id&&state.musicOn;return <button key={t.id} className={'track-item'+(on?' active':'')} aria-current={on?'true':undefined} onClick={()=>s.playTrack(m,t.id)}><span><strong>{t.title}</strong><small>{t.author}</small></span><small>{formatDuration(t.durationSec)}</small></button>;})}</div></section>
 <section className="panel music-mixer"><h3>Mixer e timer</h3>
 <label>Música<input type="range" min={0} max={100} value={Math.round(state.musicVolume*100)} onChange={e=>s.setVolume('music',Number(e.target.value)/100)}/></label>
 <label>Ondas<input type="range" min={0} max={100} value={Math.round(state.wavesVolume*100)} onChange={e=>s.setVolume('waves',Number(e.target.value)/100)}/></label>
 <p className="music-note">Desligar em</p><div className="noise-picker">{TIMERS.map(([label,mins])=><button key={label} className={'noise-pill'+(mins===null&&!state.timerEndsAt?' active':'')} onClick={()=>s.setTimer(mins)}>{label}</button>)}</div>
 {state.timerEndsAt&&left&&<p className="music-note">Desliga em {left}</p>}
 <label className="music-check"><input type="checkbox" checked={state.focusAutoplay} onChange={e=>s.setFocusAutoplay(e.target.checked)}/>Tocar ondas de foco ao iniciar um Pomodoro</label></section>
 </div>
 <section className="panel music-credits"><h3>Créditos</h3>{TRACKS.map(t=><p key={t.id}>{t.credit} <a href={t.sourceUrl} target="_blank" rel="noreferrer">fonte</a> · <a href={t.licenseUrl} target="_blank" rel="noreferrer">licença</a></p>)}
 <p>As ondas e os ruídos são gerados no seu navegador. No iPhone, o volume da música segue o volume do aparelho.</p></section></>;}
export function MiniPlayer(){const {state,togglePlay,next,stop}=useSound(),{navigate}=useApp(),left=useRemaining(state.timerEndsAt);
 if(!state.visible)return null;
 const track=TRACKS.find(t=>t.id===state.trackId)||null,label=nowPlaying({moment:state.moment,track,musicPlaying:state.musicOn&&!state.paused,wavesPlaying:state.wavesOn&&!state.paused,noise:state.noise[state.moment]});
 const open=()=>{try{sessionStorage.setItem(MOMENT_KEY,state.moment);}catch{}navigate('/musicas');};
 return <div className="mini-player" role="region" aria-label="Player de músicas"><button className="mini-player-info" onClick={open}><Headphones size={18}/><span><strong>{label}</strong><small>{MOMENTS[state.moment].label}{left?' · desliga em '+left:''}</small></span></button>
 <button className="icon-button" aria-label={state.paused?'Tocar':'Pausar'} onClick={togglePlay}>{state.paused?<Play size={17}/>:<Pause size={17}/>}</button>
 <button className="icon-button" aria-label="Próxima faixa" disabled={!state.musicOn} onClick={next}><SkipForward size={17}/></button>
 <button className="icon-button" aria-label="Fechar player" onClick={stop}><X size={17}/></button></div>;}

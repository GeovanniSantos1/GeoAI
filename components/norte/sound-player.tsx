'use client';
// Motor de som do menu Músicas: música (HTMLAudioElement), ondas binaurais e ruído (Web Audio), timer, Media Session e Pomodoro; montado em volta do app para o som seguir entre as telas.
import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';import type {ReactNode} from 'react';
import {MOMENTS,TRACKS,DEFAULT_PREFS,binaural,waveLabel,trackUrl,tracksFor,nextTrack,noiseSamples,fadeGain,sanitizePrefs} from '@/lib/sounds';import type {Moment,Noise,SoundPrefs} from '@/lib/sounds';
export type SoundState={moment:Moment;trackId:string|null;musicOn:boolean;wavesOn:boolean;paused:boolean;visible:boolean;timerEndsAt:number|null;wavesSupported:boolean}&SoundPrefs;
export type SoundApi={state:SoundState;playTrack(moment:Moment,trackId?:string):void;toggleWaves(moment:Moment):void;togglePlay():void;next():void;stop():void;setNoise(moment:Moment,noise:Noise):void;setVolume(kind:'music'|'waves',value:number):void;setTimer(minutes:number|null):void;setFocusAutoplay(on:boolean):void;focusSession(kind:'start'|'pause'|'end',endsAt?:number):void};
type AudioWindow=typeof window&{webkitAudioContext?:typeof AudioContext};type SessionNavigator=Navigator&{audioSession?:{type:string}};
type Chain={src:AudioScheduledSourceNode;nodes:AudioNode[]};
const KEY='geoai-sound',NO_WAVES='Seu navegador não toca as ondas. As músicas funcionam normalmente.',NOISE_GAIN:Record<Noise,number>={none:0,white:0.25,pink:0.8,brown:0.9};
const SoundContext=createContext<SoundApi|null>(null);
const audioContextClass=()=>{const w=window as AudioWindow;return w.AudioContext||w.webkitAudioContext;};
// iPhone: com a sessão de áudio em "playback", o som toca mesmo no modo silencioso.
function requestPlaybackSession(){try{const s=(navigator as SessionNavigator).audioSession;if(s)s.type='playback';}catch{}}
// Para e desconecta uma fonte e os nós dela, para nunca existirem duas ao mesmo tempo.
function halt(c:Chain){try{c.src.stop();}catch{}c.src.disconnect();for(const n of c.nodes)n.disconnect();}
export function SoundProvider({children,onNotice}:{children:ReactNode;onNotice:(message:string,error?:boolean)=>void}){
 const [state,setState]=useState<SoundState>(()=>{let prefs=DEFAULT_PREFS;try{prefs=sanitizePrefs(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{}return {...prefs,trackId:null,musicOn:false,wavesOn:false,paused:false,visible:false,timerEndsAt:null,wavesSupported:typeof window!=='undefined'&&!!audioContextClass()};});
 const cur=useRef(state),noticeRef=useRef(onNotice),audioRef=useRef<HTMLAudioElement|null>(null),ctxRef=useRef<AudioContext|null>(null),outRef=useRef<GainNode|null>(null),tonesRef=useRef<Chain[]>([]),noiseRef=useRef<Chain|null>(null),failsRef=useRef(0),fadeRef=useRef(1),rampRef=useRef<number|null>(null),ownedRef=useRef(false),focusEndRef=useRef<number|null>(null),selfPauseRef=useRef(false),eventsRef=useRef({ended(){},error(){},pause(){},timeupdate(){}});
 // Os handlers leem o estado atual por estes refs, nunca por valores presos ao fechamento.
 useEffect(()=>{cur.current=state;},[state]);
 useEffect(()=>{noticeRef.current=onNotice;},[onNotice]);
 const warn=useCallback((message:string)=>noticeRef.current(message,true),[]);
 const patch=useCallback((p:Partial<SoundState>)=>setState(s=>({...s,...p})),[]);
 // Volumes vezes o fator do timer (1 fora da descida); durante a descida do Pomodoro o ganho das ondas segue a rampa.
 const musicGain=useCallback((v:number)=>{if(audioRef.current)audioRef.current.volume=v*fadeRef.current;},[]);
 const wavesGain=useCallback((v:number)=>{const c=ctxRef.current,g=outRef.current;if(c&&g&&rampRef.current===null)g.gain.setTargetAtTime(v*fadeRef.current,c.currentTime,0.05);},[]);
 const startAudio=useCallback((a:HTMLAudioElement)=>{a.play().catch((e:unknown)=>{if(e instanceof DOMException&&e.name==='NotAllowedError'){warn('Toque em ▶ para começar.');patch({paused:true});}});},[warn,patch]);
 const getAudio=useCallback(()=>{let a=audioRef.current;if(!a){a=new Audio();a.preload='none';a.addEventListener('ended',()=>eventsRef.current.ended());a.addEventListener('playing',()=>{failsRef.current=0;});a.addEventListener('error',()=>eventsRef.current.error());a.addEventListener('timeupdate',()=>eventsRef.current.timeupdate());a.addEventListener('play',()=>{selfPauseRef.current=false;});a.addEventListener('pause',()=>eventsRef.current.pause());audioRef.current=a;}return a;},[]);
 const killMusic=useCallback(()=>{const a=audioRef.current;if(a){a.pause();a.removeAttribute('src');a.load();}},[]);
 const killNoise=useCallback(()=>{if(noiseRef.current)halt(noiseRef.current);noiseRef.current=null;},[]);
 const killWaves=useCallback(()=>{tonesRef.current.forEach(halt);tonesRef.current=[];killNoise();},[killNoise]);
 // Ruído: 4 s mono gerados por noiseSamples, em loop, com ganho por tipo (NOISE_GAIN) para ficar cerca de 6 dB abaixo dos tons; o branco fica um pouco mais baixo porque soa mais alto.
 const buildNoise=useCallback((kind:Noise)=>{killNoise();const c=ctxRef.current,g=outRef.current;if(!c||!g||kind==='none')return;const len=c.sampleRate*4,buf=c.createBuffer(1,len,c.sampleRate);buf.getChannelData(0).set(noiseSamples(kind,len));const src=c.createBufferSource(),gain=c.createGain();src.buffer=buf;src.loop=true;gain.gain.value=NOISE_GAIN[kind];src.connect(gain).connect(g);src.start();noiseRef.current={src,nodes:[gain]};},[killNoise]);
 // Ondas: um tom senoidal em cada ouvido (-1 e +1); a diferença entre eles é a batida binaural.
 const buildWaves=useCallback((m:Moment)=>{killWaves();const c=ctxRef.current,g=outRef.current;if(!c||!g)return;const {left,right}=binaural(m);tonesRef.current=[[left,-1],[right,1]].map(([f,p])=>{const src=c.createOscillator(),pan=c.createStereoPanner(),gain=c.createGain();src.type='sine';src.frequency.value=f;pan.pan.value=p;gain.gain.value=0.5;src.connect(pan).connect(gain).connect(g);src.start();return {src,nodes:[pan,gain]};});buildNoise(cur.current.noise[m]);},[killWaves,buildNoise]);
 const ensureContext=useCallback(()=>{if(!ctxRef.current){const C=audioContextClass();if(!C)return null;const c=new C(),g=c.createGain();g.gain.value=0;g.connect(c.destination);ctxRef.current=c;outRef.current=g;}return ctxRef.current;},[]);
 const clearRamp=useCallback(()=>{if(rampRef.current===null)return;clearTimeout(rampRef.current);rampRef.current=null;const c=ctxRef.current,g=outRef.current;if(c&&g)g.gain.cancelScheduledValues(c.currentTime);},[]);
 // Desligar as ondas também suspende o AudioContext (startWaves o retoma), para ele não seguir rodando em silêncio.
 const stopWaves=useCallback(()=>{clearRamp();killWaves();ctxRef.current?.suspend().catch(()=>{});},[clearRamp,killWaves]);
 // Posse das ondas pelo Pomodoro (ownedRef) e o intervalo que confere o fim da sessão pelo relógio (focusEndRef); pausar o Pomodoro, parar o player ou usar o botão das ondas solta as duas.
 const disarm=useCallback(()=>{if(focusEndRef.current!==null)clearInterval(focusEndRef.current);focusEndRef.current=null;},[]);
 const release=useCallback(()=>{ownedRef.current=false;disarm();},[disarm]);
 const startWaves=useCallback((m:Moment,resumeMusic=true)=>{const s=cur.current;requestPlaybackSession();let c:AudioContext|null=null;
  try{c=ensureContext();if(c){clearRamp();buildWaves(m);}}catch{killWaves();c=null;patch({wavesSupported:false});}
  if(!c){warn(NO_WAVES);return false;}
  c.resume().catch(()=>{});wavesGain(s.wavesVolume);if(resumeMusic&&s.paused&&s.musicOn&&audioRef.current)startAudio(audioRef.current);
  patch({moment:m,wavesOn:true,paused:false,visible:true});return true;},[ensureContext,clearRamp,buildWaves,killWaves,warn,wavesGain,startAudio,patch]);
 const play=useCallback((m:Moment,id?:string|null)=>{const s=cur.current,list=tracksFor(m),t=list.find(x=>x.id===id)||list[0];if(!t)return;
  const a=getAudio();selfPauseRef.current=true;a.src=trackUrl(t);a.volume=s.musicVolume*fadeRef.current;requestPlaybackSession();startAudio(a);
  if(s.wavesOn){if(s.moment!==m)buildWaves(m);ctxRef.current?.resume().catch(()=>{});}
  patch({moment:m,trackId:t.id,musicOn:true,paused:false,visible:true});},[getAudio,startAudio,buildWaves,patch]);
 const playTrack=useCallback((m:Moment,trackId?:string)=>{failsRef.current=0;play(m,trackId);},[play]);
 const next=useCallback(()=>{const s=cur.current;failsRef.current=0;play(s.moment,nextTrack(s.moment,s.trackId)?.id);},[play]);
 // Com o player pausado, "Tocar ondas" deixa as ondas audíveis em vez de desligá-las; a música pausada fica em silêncio (musicOn:false, mantendo a faixa).
 const toggleWaves=useCallback((m:Moment)=>{const s=cur.current;release();if(s.wavesOn&&s.moment===m){if(s.paused){clearRamp();wavesGain(s.wavesVolume);requestPlaybackSession();ctxRef.current?.resume().catch(()=>{});patch({paused:false,musicOn:false});}else{stopWaves();patch({wavesOn:false});}}else startWaves(m);},[release,clearRamp,wavesGain,stopWaves,patch,startWaves]);
 const resumeAll=useCallback(()=>{const s=cur.current,a=audioRef.current;requestPlaybackSession();if(s.musicOn&&a)startAudio(a);if(s.wavesOn)ctxRef.current?.resume().catch(()=>{});patch({paused:false});},[startAudio,patch]);
 const pauseAll=useCallback(()=>{selfPauseRef.current=true;audioRef.current?.pause();ctxRef.current?.suspend().catch(()=>{});patch({paused:true});},[patch]);
 const togglePlay=useCallback(()=>{const s=cur.current;if(!s.musicOn&&!s.wavesOn)playTrack(s.moment);else if(s.paused)resumeAll();else pauseAll();},[playTrack,resumeAll,pauseAll]);
 const stop=useCallback(()=>{killMusic();stopWaves();release();fadeRef.current=1;patch({musicOn:false,wavesOn:false,paused:false,visible:false,timerEndsAt:null});},[killMusic,stopWaves,release,patch]);
 const setNoise=useCallback((m:Moment,noise:Noise)=>{const s=cur.current;setState(x=>({...x,noise:{...x.noise,[m]:noise}}));if(s.wavesOn&&s.moment===m)buildNoise(noise);},[buildNoise]);
 const setVolume=useCallback((kind:'music'|'waves',value:number)=>{const v=Math.min(1,Math.max(0,value||0));if(kind==='music'){patch({musicVolume:v});musicGain(v);}else{patch({wavesVolume:v});wavesGain(v);}},[patch,musicGain,wavesGain]);
 const setTimer=useCallback((minutes:number|null)=>{const s=cur.current;fadeRef.current=1;musicGain(s.musicVolume);wavesGain(s.wavesVolume);patch({timerEndsAt:minutes?Date.now()+minutes*60000:null});},[musicGain,wavesGain,patch]);
 const setFocusAutoplay=useCallback((on:boolean)=>patch({focusAutoplay:on}),[patch]);
 // Pomodoro: só mexe nas ondas que ele mesmo ligou; ao terminar, baixa em 30 s e desliga.
 const fadeOutFocus=useCallback(()=>{if(!ownedRef.current)return;release();
  clearRamp();const c=ctxRef.current,g=outRef.current;if(!c||!g)return;const t=c.currentTime;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0,t+30);
  rampRef.current=window.setTimeout(()=>{rampRef.current=null;stopWaves();patch({wavesOn:false});},30000);},[release,clearRamp,stopWaves,patch]);
 const focusSession=useCallback((kind:'start'|'pause'|'end',endsAt?:number)=>{const s=cur.current;
  // 'start' sempre deixa as ondas de Foco audíveis; com o player pausado, a música pausada fica em silêncio (musicOn:false, mantendo a faixa).
  if(kind==='start'){if(!s.focusAutoplay||!s.wavesSupported)return;const fading=rampRef.current!==null;clearRamp();if(s.paused&&s.musicOn)patch({musicOn:false});
   if(!s.wavesOn||s.moment!=='foco'){if(startWaves('foco',false))ownedRef.current=true;}
   else{if(fading){wavesGain(s.wavesVolume);ownedRef.current=true;}if(s.paused){requestPlaybackSession();ctxRef.current?.resume().catch(()=>{});patch({paused:false});}}
   // Com o fim da sessão (endsAt), o relógio confere a cada 250 ms e baixa as ondas mesmo com a tela Foco fechada.
   if(ownedRef.current&&endsAt){disarm();focusEndRef.current=window.setInterval(()=>{if(Date.now()>=endsAt)fadeOutFocus();},250);}
   return;}
  // 'pause' e 'end' seguem a posse (não a preferência), para nada que o Pomodoro ligou ficar tocando ou armado depois dele.
  if(!ownedRef.current)return;
  if(kind==='pause'){release();stopWaves();patch({wavesOn:false});return;}
  fadeOutFocus();},[clearRamp,startWaves,wavesGain,disarm,fadeOutFocus,release,stopWaves,patch]);
 const dispose=useCallback(()=>{killMusic();clearRamp();disarm();killWaves();ctxRef.current?.close().catch(()=>{});ctxRef.current=null;outRef.current=null;if('mediaSession' in navigator){navigator.mediaSession.metadata=null;navigator.mediaSession.playbackState='none';}},[killMusic,clearRamp,disarm,killWaves]);
 // Eventos do <audio>: no fim segue para a próxima; em erro pula, até todas as faixas do momento falharem seguidas.
 // Timer vencido (no celular bloqueado o intervalo atrasa) para tudo no fim da faixa ou na próxima atualização de tempo, em vez de seguir para a próxima.
 // Pausa que não veio do motor (fone desconectado, ligação, sistema) pausa tudo, ondas inclusive; no fim da faixa o pause chega com ended=true e é ignorado.
 useEffect(()=>{const expired=()=>{const e=cur.current.timerEndsAt;return !!e&&Date.now()>=e;};eventsRef.current={
  ended(){if(expired()){stop();return;}const s=cur.current;play(s.moment,nextTrack(s.moment,s.trackId)?.id);},
  timeupdate(){if(expired())stop();},
  pause(){const a=audioRef.current;if(!selfPauseRef.current&&a?.getAttribute('src')&&!a.ended)pauseAll();},
  error(){if(!audioRef.current?.getAttribute('src'))return;const s=cur.current;failsRef.current++;
   if(failsRef.current<tracksFor(s.moment).length){if(failsRef.current===1)warn('Não foi possível tocar esta faixa agora.');play(s.moment,nextTrack(s.moment,s.trackId)?.id);}
   else{killMusic();patch({musicOn:false});}}};},[play,warn,killMusic,patch,stop,pauseAll]);
 const {musicVolume,wavesVolume,noise,focusAutoplay,moment,trackId,musicOn,wavesOn,paused,timerEndsAt}=state;
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify({musicVolume,wavesVolume,noise,focusAutoplay,moment}));}catch{}},[musicVolume,wavesVolume,noise,focusAutoplay,moment]);
 // Timer pelo relógio (continua certo com a aba em segundo plano): desce o volume nos últimos 30 s e para tudo em 0.
 useEffect(()=>{if(!timerEndsAt)return;const id=window.setInterval(()=>{const f=fadeGain(timerEndsAt-Date.now());if(f!==fadeRef.current){fadeRef.current=f;const s=cur.current;musicGain(s.musicVolume);wavesGain(s.wavesVolume);}if(f===0)stop();},250);return()=>clearInterval(id);},[timerEndsAt,musicGain,wavesGain,stop]);
 // Controles do sistema (tela de bloqueio e teclas de mídia).
 useEffect(()=>{if(!('mediaSession' in navigator))return;const ms=navigator.mediaSession;
  // play sempre retoma e pause sempre pausa, mesmo se `paused` ficou fora de sincronia depois de uma interrupção do sistema.
  const actions:[MediaSessionAction,MediaSessionActionHandler][]=[['play',()=>{const s=cur.current;if(!s.musicOn&&!s.wavesOn)togglePlay();else resumeAll();}],['pause',()=>pauseAll()],['nexttrack',()=>{if(cur.current.musicOn)next();}]];
  for(const [a,h] of actions)try{ms.setActionHandler(a,h);}catch{}
  return()=>{for(const [a] of actions)try{ms.setActionHandler(a,null);}catch{}};},[togglePlay,resumeAll,pauseAll,next]);
 useEffect(()=>{if(!('mediaSession' in navigator))return;const t=musicOn?TRACKS.find(x=>x.id===trackId):undefined,on=musicOn||wavesOn;
  navigator.mediaSession.metadata=on?new MediaMetadata({title:t?t.title:waveLabel(moment),artist:t?t.author:'GeoAI',album:'GeoAI · '+MOMENTS[moment].label}):null;
  navigator.mediaSession.playbackState=on?(paused?'paused':'playing'):'none';},[trackId,musicOn,wavesOn,moment,paused]);
 useEffect(()=>dispose,[dispose]);
 const api=useMemo<SoundApi>(()=>({state,playTrack,toggleWaves,togglePlay,next,stop,setNoise,setVolume,setTimer,setFocusAutoplay,focusSession}),[state,playTrack,toggleWaves,togglePlay,next,stop,setNoise,setVolume,setTimer,setFocusAutoplay,focusSession]);
 return <SoundContext.Provider value={api}>{children}</SoundContext.Provider>;
}
export function useSound():SoundApi{const api=useContext(SoundContext);if(!api)throw new Error('useSound() precisa estar dentro de <SoundProvider>.');return api;}

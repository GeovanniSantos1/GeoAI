'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';import {Sparkles,SquareKanban,Timer,Sun,WandSparkles,ChartColumn,History,type LucideIcon} from 'lucide-react';
import {useApp} from './context';import {FocoCtx,type FocoApi,type FocoTab} from './focus-context';import {PageHeading,Tabs,Modal} from './primitives';import {foco,ApiError} from './focus-api';
import {FocusBoard} from './focus-board';import {CardDetail} from './focus-card';import {FocusTimer} from './focus-timer';import {FocusToday} from './focus-today';import {FocusTriage} from './focus-triage';import {FocusReportTab} from './focus-report';import {FocusAudit} from './focus-audit';import {FocusAssistant} from './focus-assistant';
import {summarize,codeOf,type CardSummary} from '@/lib/board';import {FOCUS_BUSY} from '@/lib/focus';
// Moldura do Foco: abas, painel do assistente e o detalhe do card; o quadro fica aqui e as abas leem pelo contexto.
const TABS:{id:FocoTab;label:string;icon:LucideIcon}[]=[{id:'board',label:'Quadro',icon:SquareKanban},{id:'timer',label:'Timer',icon:Timer},{id:'today',label:'Hoje',icon:Sun},{id:'triage',label:'Triagem',icon:WandSparkles},{id:'report',label:'Relatório',icon:ChartColumn},{id:'audit',label:'Auditoria',icon:History}];
const isTab=(v:unknown):v is FocoTab=>TABS.some(t=>t.id===v);
// O atalho de foco das Tarefas abre o Timer; o mini-timer e o aviso de fim pedem uma aba pelo sessionStorage.
function firstTab():FocoTab{try{if(sessionStorage.getItem('norte-focus-label'))return 'timer';const t=sessionStorage.getItem('geoai-foco-tab');sessionStorage.removeItem('geoai-foco-tab');if(isTab(t))return t;}catch{}return 'board';}
// O painel começa aberto em telas largas (1600 px ou mais) e depois lembra a escolha da pessoa.
function firstPanel(){try{const v=localStorage.getItem('geoai-foco-panel');if(v)return v==='1';}catch{}return window.innerWidth>=1600;}
const remember=(v:boolean)=>{try{localStorage.setItem('geoai-foco-panel',v?'1':'0');}catch{}};
// Ornamento do cabeçalho: o anel do pomodoro em tons claros, só decoração.
function HeroArt(){return <svg className="fo-hero-art" viewBox="0 0 240 240" aria-hidden="true" focusable="false"><circle className="fo-art-halo" cx="120" cy="120" r="112"/><circle className="fo-art-ticks" cx="120" cy="120" r="94"/><circle className="fo-art-track" cx="120" cy="120" r="72"/><circle className="fo-art-arc" cx="120" cy="120" r="72" transform="rotate(-90 120 120)"/><circle className="fo-art-break" cx="120" cy="120" r="72" transform="rotate(-90 120 120)"/>
 <ellipse className="fo-art-tomato" cx="120" cy="125" rx="21" ry="18"/><path className="fo-art-leaf" d="M120 109l-11-3m11 3-6-8m6 8 6-8m-6 8 11-3m-11 3q1-6 4-10"/><circle className="fo-art-dot" cx="205.8" cy="48" r="4"/><circle className="fo-art-dot alt" cx="23" cy="176" r="3"/></svg>;}
export function FocusView(){const a=useApp();const {toast,sync}=a;const clients=a.state.clients;
 const [tab,setTab]=useState<FocoTab>(firstTab),[cards,setCards]=useState<CardSummary[]>([]),[archivedCount,setArchived]=useState(0),[loading,setLoading]=useState(true),[openId,setOpenId]=useState<string|null>(null),[pending,setPending]=useState<string|null>(null),[ai,setAi]=useState(false),[panel,setPanel]=useState(firstPanel),[queued,setQueued]=useState(0);
 const apply=useCallback((r:{cards:CardSummary[];archivedCount:number})=>{setCards(r.cards);setArchived(r.archivedCount);setLoading(false);},[]);
 const fail=useCallback((e:unknown)=>{setLoading(false);toast(e instanceof Error?e.message:'Não foi possível carregar o quadro.',true);},[toast]);
 const reload=useCallback(()=>foco.board().then(apply).catch(fail),[apply,fail]);
 useEffect(()=>{foco.board().then(apply).catch(fail);fetch('/api/foco/assistant').then(r=>r.json()).then(j=>setAi(j.mode==='ai')).catch(()=>{});},[apply,fail]);
 useEffect(()=>{const vis=()=>{if(document.visibilityState==='visible')reload();},onTab=(e:Event)=>{const t=(e as CustomEvent).detail;if(isTab(t)){setTab(t);try{sessionStorage.removeItem('geoai-foco-tab');}catch{}}},onPanel=()=>setPanel(p=>{remember(!p);return !p;}),onRefresh=()=>{reload();};
  document.addEventListener('visibilitychange',vis);window.addEventListener('geoai:foco-tab',onTab);window.addEventListener('geoai:foco-panel',onPanel);window.addEventListener('geoai:foco-refresh',onRefresh);
  return()=>{document.removeEventListener('visibilitychange',vis);window.removeEventListener('geoai:foco-tab',onTab);window.removeEventListener('geoai:foco-panel',onPanel);window.removeEventListener('geoai:foco-refresh',onRefresh);};},[reload]);
 useEffect(()=>{window.dispatchEvent(new CustomEvent('geoai:foco-queue',{detail:queued}));},[queued]);
 useEffect(()=>()=>{window.dispatchEvent(new CustomEvent('geoai:foco-queue',{detail:0}));},[]);
 const start=useCallback(async(id:string,replace=false)=>{try{const r=await foco.start(id,replace);sync(r);setCards(cs=>cs.map(c=>c.id===r.card.id?summarize(r.card):c));window.dispatchEvent(new Event('geoai:foco-refresh'));}
  catch(e){if(e instanceof ApiError&&e.message===FOCUS_BUSY&&!replace){setPending(id);return;}toast(e instanceof Error?e.message:'Não foi possível iniciar o pomodoro.',true);}},[sync,toast]);
 const clientName=useCallback((id:string|null)=>id?clients.find(c=>c.id===id)?.title||'':'',[clients]);
 const closeCard=useCallback(()=>setOpenId(null),[]);
 const api:FocoApi=useMemo(()=>({cards,archivedCount,loading,ai,reload:async()=>{await reload();},setCards,open:setOpenId,start:(id:string)=>start(id),setTab,clientName,openId}),[cards,archivedCount,loading,ai,reload,start,clientName,openId]);
 const togglePanel=()=>{remember(!panel);setPanel(!panel);};
 const pendingCard=cards.find(c=>c.id===pending);
 return <FocoCtx.Provider value={api}><div className={'fo-shell'+(panel?' with-panel':'')}><div className="fo-main">
   <div className="fo-hero"><HeroArt/><PageHeading eyebrow="QUADRO E POMODORO" title="Foco" description="Escolha o próximo card, comece o pomodoro e deixe o resto esperar."><button className="button outline fo-panel-toggle" aria-expanded={panel} onClick={togglePanel}><Sparkles size={16}/>Assistente{queued>0&&<span className="fo-badge" aria-label={queued+' na fila'}>{queued}</span>}</button></PageHeading></div>
   <div className="toolbar fo-tabbar"><Tabs value={tab} onChange={t=>setTab(t as FocoTab)} items={TABS}/></div>
   <div key={tab} className="fo-tabpane">{tab==='board'&&<FocusBoard/>}{tab==='timer'&&<FocusTimer/>}{tab==='today'&&<FocusToday/>}{tab==='triage'&&<FocusTriage/>}{tab==='report'&&<FocusReportTab/>}{tab==='audit'&&<FocusAudit/>}</div></div>
  <FocusAssistant open={panel} onClose={()=>{remember(false);setPanel(false);}} onQueue={setQueued}/></div>
  {openId&&<CardDetail key={openId} id={openId} onClose={closeCard}/>}
  {pending&&<Modal title="Já há um pomodoro em andamento" subtitle={a.state.focusTimer?.title} onClose={()=>setPending(null)}><p className="modal-copy">Interromper e começar no {pendingCard?codeOf(pendingCard):'card'}?</p>
   <div className="modal-footer"><button className="button ghost" onClick={()=>setPending(null)}>Cancelar</button><button className="button primary" onClick={()=>{const id=pending;setPending(null);start(id,true);}}>Interromper e começar</button></div></Modal>}
 </FocoCtx.Provider>;}

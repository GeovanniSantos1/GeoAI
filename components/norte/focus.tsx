'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';import {Sparkles} from 'lucide-react';
import {useApp} from './context';import {FocoCtx,type FocoApi,type FocoTab} from './focus-context';import {PageHeading,Tabs,Modal} from './primitives';import {foco,ApiError} from './focus-api';
import {FocusBoard} from './focus-board';import {CardDetail} from './focus-card';import {FocusTimer} from './focus-timer';import {FocusToday} from './focus-today';import {FocusTriage} from './focus-triage';import {FocusReportTab} from './focus-report';import {FocusAudit} from './focus-audit';import {FocusAssistant} from './focus-assistant';
import {summarize,codeOf,type CardSummary} from '@/lib/board';import {FOCUS_BUSY} from '@/lib/focus';
// Moldura do Foco: abas, painel do assistente e o detalhe do card; o quadro fica aqui e as abas leem pelo contexto.
const TABS:{id:FocoTab;label:string}[]=[{id:'board',label:'Quadro'},{id:'timer',label:'Timer'},{id:'today',label:'Hoje'},{id:'triage',label:'Triagem'},{id:'report',label:'Relatório'},{id:'audit',label:'Auditoria'}];
const isTab=(v:unknown):v is FocoTab=>TABS.some(t=>t.id===v);
// O atalho de foco das Tarefas abre o Timer; o mini-timer e o aviso de fim pedem uma aba pelo sessionStorage.
function firstTab():FocoTab{try{if(sessionStorage.getItem('norte-focus-label'))return 'timer';const t=sessionStorage.getItem('geoai-foco-tab');sessionStorage.removeItem('geoai-foco-tab');if(isTab(t))return t;}catch{}return 'board';}
// O painel começa aberto em telas largas (1600 px ou mais) e depois lembra a escolha da pessoa.
function firstPanel(){try{const v=localStorage.getItem('geoai-foco-panel');if(v)return v==='1';}catch{}return window.innerWidth>=1600;}
const remember=(v:boolean)=>{try{localStorage.setItem('geoai-foco-panel',v?'1':'0');}catch{}};
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
   <PageHeading eyebrow="QUADRO E POMODORO" title="Foco" description="Escolha o próximo card, comece o pomodoro e deixe o resto esperar."><button className="button outline fo-panel-toggle" aria-expanded={panel} onClick={togglePanel}><Sparkles size={16}/>Assistente{queued>0&&<span className="fo-badge" aria-label={queued+' na fila'}>{queued}</span>}</button></PageHeading>
   <div className="toolbar"><Tabs value={tab} onChange={t=>setTab(t as FocoTab)} items={TABS}/></div>
   {tab==='board'&&<FocusBoard/>}{tab==='timer'&&<FocusTimer/>}{tab==='today'&&<FocusToday/>}{tab==='triage'&&<FocusTriage/>}{tab==='report'&&<FocusReportTab/>}{tab==='audit'&&<FocusAudit/>}</div>
  <FocusAssistant open={panel} onClose={()=>{remember(false);setPanel(false);}} onQueue={setQueued}/></div>
  {openId&&<CardDetail key={openId} id={openId} onClose={closeCard}/>}
  {pending&&<Modal title="Já há um pomodoro em andamento" subtitle={a.state.focusTimer?.title} onClose={()=>setPending(null)}><p className="modal-copy">Interromper e começar no {pendingCard?codeOf(pendingCard):'card'}?</p>
   <div className="modal-footer"><button className="button ghost" onClick={()=>setPending(null)}>Cancelar</button><button className="button primary" onClick={()=>{const id=pending;setPending(null);start(id,true);}}>Interromper e começar</button></div></Modal>}
 </FocoCtx.Provider>;}

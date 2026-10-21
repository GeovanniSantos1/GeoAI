'use client';
import {useEffect,useState,type CSSProperties} from 'react';import {Play,Pause,Square,Settings,Timer,Leaf,Check,Target,Coffee,Sofa} from 'lucide-react';
import {useApp} from './context';import {useFoco} from './focus-context';import {Modal,Stat,Empty,RecordActions} from './primitives';import {Ring,mmss} from './focus-ui';import {useRemaining} from './focus-mini-timer';
import {KIND_LABEL} from '@/lib/focus';import {sortCards,codeOf,STATUS_LABEL} from '@/lib/board';import type {FocusKind} from '@/lib/types';
// Aba Timer: o anel grande, a escolha do que focar (card ou foco livre) e as sessões de hoje.
const KIND_ICON:Record<FocusKind,typeof Target>={focus:Target,short:Coffee,long:Sofa};
export function FocusTimer(){const a=useApp(),f=useFoco();const t=a.state.focusTimer,left=useRemaining(t),s=a.state.profile.focus,paused=!!t&&t.pausedLeft!==undefined;
 const [kind,setKind]=useState<FocusKind>('focus'),[target,setTarget]=useState(''),[stopping,setStopping]=useState(false),[reason,setReason]=useState(''),[settings,setSettings]=useState(false);
 // O atalho de foco da lista de Tarefas deixa o rótulo no sessionStorage.
 const [text,setText]=useState(()=>{try{return sessionStorage.getItem('norte-focus-label')||'';}catch{return '';}});
 useEffect(()=>{try{sessionStorage.removeItem('norte-focus-label');}catch{}},[]);
 const minutesFor=(k:FocusKind)=>k==='focus'?s.focusMinutes:k==='short'?s.shortBreakMinutes:s.longBreakMinutes;
 const options=sortCards(f.cards.filter(c=>c.status!=='done'&&c.status!=='archived')).sort((x,y)=>Number(y.status==='doing')-Number(x.status==='doing'));
 const chosen=options.find(c=>c.id===target),total=(t?t.minutes:minutesFor(kind))*60,shown=t?left:total;
 const caption=t?(t.kind==='focus'?(t.code?'Foco · '+t.code:'Foco livre'):KIND_LABEL[t.kind]):kind==='focus'?(chosen?'Foco · '+codeOf(chosen):'Foco livre'):KIND_LABEL[kind];
 const todays=a.state.focusSessions.filter(x=>x.date===a.today&&(x.kind??'focus')==='focus'),completed=todays.filter(x=>(x.status??'completed')==='completed');
 const codeFor=(id?:string)=>{const c=id?f.cards.find(x=>x.id===id):undefined;return c?codeOf(c)+' · ':'';};
 // O painel ganha a cor do tipo (tomate no foco, verde na pausa) e o estado, para o halo e o selo.
 const focusTone=(t?.kind??kind)==='focus',mood=(focusTone?'is-focus':'is-break')+(t?(paused?' is-paused':' is-running'):' is-idle');
 async function begin(){if(kind==='focus'&&chosen){await f.start(chosen.id);return;}await a.mutate({type:'focus',action:'start',kind,...(kind==='focus'?{title:text}:{})});}
 return <div className="focus-layout fo-timer"><section className={'panel timer-panel fo-tpanel '+mood}>
  <div className="card-kicker fo-kicker"><span className="fo-kicker-pill"><span className="status-dot"/>{t?(paused?'PAUSADO':'SEU MOMENTO ESTÁ ACONTECENDO'):'RESPIRA. ESCOLHE. COMEÇA.'}</span><button className="icon-button fo-gear" aria-label="Ajustes do foco" onClick={()=>setSettings(true)}><Settings size={17}/></button></div>
  <div className="fo-big"><span className="fo-halo" aria-hidden="true"/><Ring fraction={total?shown/total:0} stroke={10} tone={focusTone?'var(--fo-tomato)':'var(--green)'}><strong className="fo-ring-time">{mmss(shown)}</strong><small>{caption}</small></Ring></div>
  {!t?<><div className="duration-choices fo-seg">{(['focus','short','long'] as FocusKind[]).map(k=>{const I=KIND_ICON[k];return <button key={k} className={'fo-k-'+k+(k===kind?' selected':'')} aria-pressed={k===kind} onClick={()=>setKind(k)}><I size={15}/><b>{KIND_LABEL[k]}</b><span className="fo-seg-sep"> · </span><small>{minutesFor(k)} min</small></button>;})}</div>
   {kind==='focus'&&<><label className="field fo-target"><span>O que focar</span><select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Foco livre</option>{options.map(c=><option key={c.id} value={c.id}>{codeOf(c)} {c.title} · {STATUS_LABEL[c.status]}</option>)}</select></label>
    {!chosen&&<label className="focus-label"><span>Em que você vai focar?</span><input value={text} onChange={e=>setText(e.target.value)} maxLength={120} placeholder="Ex.: ler um capítulo, terminar o projeto…"/></label>}</>}
   <div className="timer-controls"><button className="button primary" disabled={a.busy} onClick={begin}><Play size={18} fill="currentColor"/>Começar</button></div></>
  :<div className="timer-controls">{paused?<button className="button primary" disabled={a.busy} onClick={()=>a.mutate({type:'focus',action:'resume'})}><Play size={18} fill="currentColor"/>Retomar</button>
    :<button className="button primary" disabled={a.busy} onClick={()=>a.mutate({type:'focus',action:'pause'})}><Pause size={18}/>Pausar</button>}
   <button className="button outline" disabled={a.busy} onClick={()=>setStopping(true)}><Square size={16}/>Interromper</button></div>}
  {stopping&&t&&<div className="fo-pop" role="dialog" aria-label="Interromper o pomodoro?"><b>Interromper o pomodoro?</b><small>Fica registrado como interrompido.</small>
   <input value={reason} maxLength={200} onChange={e=>setReason(e.target.value)} placeholder="Motivo (opcional)" aria-label="Motivo (opcional)"/>
   <div className="fo-row-end"><button className="button ghost small" onClick={()=>setStopping(false)}>Voltar</button><button className="button destructive small" disabled={a.busy} onClick={async()=>{if(await a.mutate({type:'focus',action:'stop',reason})){setStopping(false);setReason('');}}}>Interromper</button></div></div>}</section>
  <aside><div className="stats-grid two fo-tstats"><Stat label="Sessões hoje" value={<>{completed.length}{completed.length>0&&<span className="fo-pips" aria-hidden="true">{completed.slice(0,8).map(x=><i key={x.id}/>)}{completed.length>8&&<small>+{completed.length-8}</small>}</span>}</>} icon={Timer}/><Stat label="Minutos de foco" value={completed.reduce((x,y)=>x+(y.duration||0),0)} icon={Leaf}/></div>
   <section className="panel"><header className="section-heading"><h2>Seus momentos de hoje</h2></header>
    {todays.length?<div className="fo-timeline">{todays.slice().reverse().map((x,i)=><div className={'session-row fo-moment'+(x.status==='interrupted'?' is-cut':'')} key={x.id} style={{'--i':i} as CSSProperties}><span className="icon-tile">{x.status!=='interrupted'&&<Check size={13} strokeWidth={3}/>}</span><span><strong>{codeFor(x.boardCardId)}{x.title}</strong><small>{x.duration} minutos de foco{x.status==='interrupted'?' · interrompida':''}</small></span><RecordActions item={x} onEdit={()=>a.edit('focusSessions',x)} onDelete={()=>a.remove('focusSessions',x)}/></div>)}</div>
    :<Empty title="Seu primeiro momento de foco" description="Comece o pomodoro. Sua sessão aparece aqui quando for concluída." icon={Timer}/>}</section></aside>
  {settings&&<FocusSettings onClose={()=>setSettings(false)}/>}</div>;}
function FocusSettings({onClose}:{onClose:()=>void}){const a=useApp();const s=a.state.profile.focus;
 const [v,setV]=useState({focusMinutes:String(s.focusMinutes),shortBreakMinutes:String(s.shortBreakMinutes),longBreakMinutes:String(s.longBreakMinutes)}),[mode,setMode]=useState(s.focusMode);
 const fields:[keyof typeof v,string,number][]=[['focusMinutes','Foco (min)',90],['shortBreakMinutes','Pausa curta (min)',30],['longBreakMinutes','Pausa longa (min)',60]];
 return <Modal title="Ajustes do foco" onClose={onClose} className="fo-settings"><form onSubmit={async e=>{e.preventDefault();if(await a.mutate({type:'profile',profile:{focus:{focusMinutes:Number(v.focusMinutes),shortBreakMinutes:Number(v.shortBreakMinutes),longBreakMinutes:Number(v.longBreakMinutes),focusMode:mode}}})){a.toast('Ajustes salvos.');onClose();}}}>
  <div className="form-grid">{fields.map(([k,l,max])=><label key={k} className="field"><span>{l}</span><input type="number" min={1} max={max} step={1} required value={v[k]} onChange={e=>setV({...v,[k]:e.target.value})}/></label>)}
   <label className="fo-switch fo-full"><input type="checkbox" checked={mode} onChange={e=>setMode(e.target.checked)}/><span><b>Modo foco</b><small>Durante um foco, o assistente esconde sugestões e segura as aprovações até a pausa.</small></span></label></div>
  <footer className="modal-footer"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={a.busy}>Salvar</button></footer></form></Modal>;}

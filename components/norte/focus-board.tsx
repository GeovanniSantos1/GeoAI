'use client';
import {useEffect,useRef,useState} from 'react';import {Plus,Play,Archive,CalendarDays,Sparkles,Search,LoaderCircle,RotateCcw} from 'lucide-react';
import {useApp} from './context';import {useFoco} from './focus-context';import {Modal,Empty} from './primitives';import {PriorityBadge,ddmm} from './focus-ui';import {foco,ApiError} from './focus-api';
import {COLUMNS,STATUS_LABEL,AREAS,AREA_LABEL,PRIORITIES,PRIORITY_LABEL,sortCards,isOverdue,donePomodoros,summarize,codeOf,type CardStatus,type CardSummary} from '@/lib/board';
const fold=(v:string)=>v.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
export function FocusBoard(){const a=useApp(),f=useFoco();const {toast}=a;
 const [q,setQ]=useState(''),[area,setArea]=useState(''),[col,setCol]=useState<CardStatus>('todo'),[creating,setCreating]=useState(false),[archived,setArchived]=useState(false),[over,setOver]=useState<CardStatus|null>(null);
 const queue=useRef<Promise<unknown>>(Promise.resolve()),cardsRef=useRef(f.cards);useEffect(()=>{cardsRef.current=f.cards;});
 const term=fold(q.trim()),visible=f.cards.filter(c=>(!area||c.area===area)&&(!term||fold(codeOf(c)+' '+c.title+' '+f.clientName(c.clientId)).includes(term)));
 // Mover é otimista: a coluna muda na hora e a gravação vai em fila; se falhar, o card volta e aparece o aviso.
 function move(id:string,status:CardStatus){const before=f.cards.find(c=>c.id===id);if(!before||before.status===status)return;f.setCards(cs=>cs.map(c=>c.id===id?{...c,status}:c));
  const run=queue.current.then(async()=>{const cur=cardsRef.current.find(c=>c.id===id);if(!cur)return;
   try{const r=await foco.patch(id,cur.rev,{status});f.setCards(cs=>cs.map(c=>c.id===id?summarize(r.card):c));}
   catch(e){f.setCards(cs=>cs.map(c=>c.id===id?{...c,status:before.status}:c));toast(e instanceof Error?e.message:'Não foi possível mover o card.',true);if(e instanceof ApiError&&e.status===409)f.reload();}});
  queue.current=run.catch(()=>{});}
 const counts=Object.fromEntries(COLUMNS.map(s=>[s,visible.filter(c=>c.status===s).length]));
 return <>
  <div className="fo-board-tools"><label className="fo-search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filtrar cards…" aria-label="Filtrar cards"/></label>
   <select className="fo-select" value={area} onChange={e=>setArea(e.target.value)} aria-label="Filtrar por área"><option value="">Todas as áreas</option>{AREAS.map(x=><option key={x} value={x}>{AREA_LABEL[x]}</option>)}</select>
   <button className="button ghost small" onClick={()=>setArchived(true)}><Archive size={15}/>Arquivados ({f.archivedCount})</button>
   <button className="button primary" onClick={()=>setCreating(true)}><Plus size={17}/>Novo card</button></div>
  {!f.loading&&!f.cards.length?<Empty title="Seu quadro está vazio" description="Crie um card para começar." action="Novo card" onAction={()=>setCreating(true)}/>:<>
   <div className="fo-colpick" role="tablist" aria-label="Coluna">{COLUMNS.map(s=><button key={s} role="tab" aria-selected={col===s} className={col===s?'active':''} onClick={()=>setCol(s)}>{STATUS_LABEL[s]}<span>{counts[s]}</span></button>)}</div>
   <div className="fo-columns">{COLUMNS.map(s=><section key={s} className={'fo-col'+(col===s?' active':'')+(over===s?' over':'')} aria-label={STATUS_LABEL[s]}
     onDragOver={e=>{e.preventDefault();if(over!==s)setOver(s);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOver(null);}} onDrop={e=>{e.preventDefault();setOver(null);const id=e.dataTransfer.getData('text/plain');if(id)move(id,s);}}>
    <header><h3>{STATUS_LABEL[s]}</h3><span>{counts[s]}</span></header>
    <div className="fo-col-body">{sortCards(visible.filter(c=>c.status===s)).map(c=><BoardCard key={c.id} c={c} onMove={move}/>)}</div></section>)}</div></>}
  {creating&&<NewCardModal onClose={()=>setCreating(false)}/>}{archived&&<ArchivedModal onClose={()=>setArchived(false)}/>}</>;}
function BoardCard({c,onMove}:{c:CardSummary;onMove:(id:string,s:CardStatus)=>void}){const a=useApp(),f=useFoco();const done=donePomodoros(a.state.focusSessions,c.id),client=c.clientId?f.clientName(c.clientId):'',late=isOverdue(c,a.today),t=c.tests;
 return <article className={'fo-card prio-'+c.priority} draggable onDragStart={e=>{e.dataTransfer.setData('text/plain',c.id);e.dataTransfer.effectAllowed='move';}} tabIndex={0} role="button" aria-label={codeOf(c)+' '+c.title}
  onClick={()=>f.open(c.id)} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();f.open(c.id);}}}>
  <header><span className="fo-code">{codeOf(c)}</span><PriorityBadge p={c.priority}/></header><h4>{c.title}</h4>
  <p className="fo-meta">{AREA_LABEL[c.area]}{client&&' · '+client}</p>
  <footer>{c.dueDate&&<span className={'fo-due'+(late?' late':'')}><CalendarDays size={13}/>{ddmm(c.dueDate)}</span>}{c.hasProposal&&<span className="fo-ai-tag"><Sparkles size={12}/>IA para revisar</span>}
   {t.passed+t.failed+t.pending>0&&<span className="fo-tests-mini" title="Casos de teste: passou, falhou, pendente">✓{t.passed} ✗{t.failed} ○{t.pending}</span>}
   {c.status!=='done'&&<button className="icon-button fo-start" aria-label={'Iniciar '+codeOf(c)} title="Iniciar" onClick={e=>{e.stopPropagation();f.start(c.id);}}><Play size={15} fill="currentColor"/></button>}</footer>
  {c.estimate>0&&<div className={'fo-pomos'+(done>c.estimate?' over':'')}><span><i style={{width:Math.min(100,done/c.estimate*100)+'%'}}/></span><small>🍅 {done}/{c.estimate}</small></div>}
  <select className="fo-move" aria-label={'Mover '+codeOf(c)+' para'} value="" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onChange={e=>{const v=e.target.value as CardStatus;if(v)onMove(c.id,v);}}><option value="">Mover para…</option>{COLUMNS.filter(s=>s!==c.status).map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></article>;}
export function NewCardModal({onClose}:{onClose:()=>void}){const a=useApp(),f=useFoco();const clients=a.state.clients;
 const [v,setV]=useState({title:'',description:'',area:'pessoal',clientId:'',priority:'medium',dueDate:'',estimate:'0',tags:'',status:'backlog'}),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const set=(k:keyof typeof v)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>setV({...v,[k]:e.target.value});
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setSaving(true);
  try{const r=await foco.create([{title:v.title,description:v.description,area:v.area,priority:v.priority,status:v.status,estimate:Number(v.estimate)||0,tags:v.tags,...(v.clientId?{clientId:v.clientId}:{}),...(v.dueDate?{dueDate:v.dueDate}:{})}]);
   const c=r.cards[0];a.toast(codeOf(c)+' criado em '+STATUS_LABEL[c.status]+'.');await f.reload();onClose();}catch(err){setError(err instanceof Error?err.message:'Confira os dados.');}finally{setSaving(false);}}
 return <Modal title="Novo card" subtitle="Ele aparece no quadro na hora." onClose={()=>!saving&&onClose()}><form onSubmit={submit}><div className="form-grid">
  <label className="field full"><span>Título<i> *</i></span><input required maxLength={200} value={v.title} onChange={set('title')} autoFocus/></label>
  <label className="field full"><span>Descrição</span><textarea rows={4} maxLength={8000} value={v.description} onChange={set('description')}/></label>
  <label className="field"><span>Área</span><select value={v.area} onChange={set('area')}>{AREAS.map(x=><option key={x} value={x}>{AREA_LABEL[x]}</option>)}</select></label>
  {clients.length>0&&<label className="field"><span>Cliente</span><select value={v.clientId} onChange={set('clientId')}><option value="">Sem cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
  <label className="field"><span>Prioridade</span><select value={v.priority} onChange={set('priority')}>{PRIORITIES.map(p=><option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></label>
  <label className="field"><span>Prazo</span><input type="date" value={v.dueDate} onChange={set('dueDate')}/></label>
  <label className="field"><span>Estimativa (pomodoros)</span><input type="number" min={0} max={40} value={v.estimate} onChange={set('estimate')}/><small>0 = sem estimativa (aparece na Triagem)</small></label>
  <label className="field"><span>Coluna</span><select value={v.status} onChange={set('status')}><option value="backlog">Backlog</option><option value="todo">A fazer</option></select></label>
  <label className="field full"><span>Tags</span><input value={v.tags} onChange={set('tags')} placeholder="Separadas por vírgula"/></label></div>
  {error&&<p role="alert" className="form-error">{error}</p>}
  <footer className="modal-footer"><button type="button" className="button ghost" onClick={onClose} disabled={saving}>Cancelar</button><button className="button primary" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>}Criar card</button></footer></form></Modal>;}
function ArchivedModal({onClose}:{onClose:()=>void}){const {toast}=useApp(),f=useFoco();const [list,setList]=useState<CardSummary[]|null>(null),[busy,setBusy]=useState('');
 useEffect(()=>{foco.board(true).then(r=>setList(r.cards)).catch(e=>{toast(e instanceof Error?e.message:'Não foi possível abrir os arquivados.',true);setList([]);});},[toast]);
 async function restore(c:CardSummary){setBusy(c.id);try{await foco.patch(c.id,c.rev,{status:'backlog'});setList(l=>l&&l.filter(x=>x.id!==c.id));await f.reload();toast(codeOf(c)+' voltou para o Backlog.');}
  catch(e){toast(e instanceof Error?e.message:'Não foi possível restaurar.',true);}finally{setBusy('');}}
 return <Modal title="Cards arquivados" subtitle="Os mais recentes primeiro." onClose={onClose}>{list===null?<p className="quiet-copy"><LoaderCircle size={15} className="spin"/> Carregando…</p>
  :list.length?<ul className="fo-archived">{list.map(c=><li key={c.id}><span><b>{codeOf(c)}</b> {c.title}</span><button className="button outline small" disabled={busy===c.id} onClick={()=>restore(c)}><RotateCcw size={14}/>Restaurar</button></li>)}</ul>
  :<p className="quiet-copy">Nenhum card arquivado.</p>}</Modal>;}

'use client';
import {useState} from 'react';import {Sparkles,Check,Circle,LoaderCircle} from 'lucide-react';
import {useApp} from './context';import {useFoco} from './focus-context';import {Empty} from './primitives';import {foco,triageStream,ApiError} from './focus-api';
import {AREAS,AREA_LABEL,PRIORITIES,PRIORITY_LABEL,codeOf,donePomodoros} from '@/lib/board';
// Triagem dos cards novos (Backlog sem estimativa): a IA sugere, a pessoa corrige e aplica tudo de uma vez.
type Field='area'|'priority'|'estimate';
type Row={area:string;priority:string;estimate:string;edited:Field[];step:'pending'|'working'|'done'};
const blank=():Row=>({area:'',priority:'',estimate:'',edited:[],step:'pending'});
const complete=(r:Row)=>!!r.area&&!!r.priority&&Number(r.estimate)>=1;
export function FocusTriage(){const a=useApp(),f=useFoco();const {toast}=a;const [rows,setRows]=useState<Record<string,Row>>({}),[running,setRunning]=useState(false),[applying,setApplying]=useState(false);
 const fresh=f.cards.filter(c=>c.status==='backlog'&&c.estimate===0).sort((x,y)=>x.createdAt.localeCompare(y.createdAt)).slice(0,20);
 const row=(id:string)=>rows[id]||blank();
 const edit=(id:string,k:Field,v:string)=>setRows(r=>{const cur=r[id]||blank(),next={...cur,[k]:v,edited:[...new Set([...cur.edited,k])]};return {...r,[id]:{...next,step:complete(next)?'done':cur.step==='working'?'working':'pending'}};});
 async function runAi(){setRunning(true);setRows(r=>{const n={...r};for(const c of fresh){const cur=n[c.id]||blank();if(cur.step!=='done')n[c.id]={...cur,step:'working'};}return n;});
  try{await triageStream(fresh.map(c=>c.id),s=>setRows(r=>{const cur=r[s.cardId]||blank(),pick=(k:Field,v:string)=>cur.edited.includes(k)&&cur[k]?cur[k]:v;
    return {...r,[s.cardId]:{...cur,area:pick('area',s.area),priority:pick('priority',s.priority),estimate:pick('estimate',String(s.estimate)),step:'done'}};}));}
  catch(e){toast(e instanceof Error?e.message:'Não foi possível triar agora.',true);}
  finally{setRunning(false);setRows(r=>{const n={...r};for(const id of Object.keys(n))if(n[id].step==='working')n[id]={...n[id],step:'pending'};return n;});}}
 async function applyAll(){setApplying(true);
  try{const r=await foco.apply('aplicar_triagem',{itens:fresh.map(c=>{const x=row(c.id);return {cardId:c.id,area:x.area,prioridade:x.priority,estimativa:Number(x.estimate)};})});
   const n=r.set.changes.filter(x=>x.field==='status').length;toast(n+(n===1?' card triado e movido':' cards triados e movidos')+' para A fazer.');setRows({});await f.reload();}
  catch(e){toast(e instanceof ApiError&&e.body.set?.errors?.length?e.body.set.errors.join(' '):e instanceof Error?e.message:'Não foi possível aplicar.',true);}finally{setApplying(false);}}
 if(!fresh.length)return <Empty title="Triagem em dia" description="Nenhum card novo para triar."/>;
 const load=f.cards.filter(c=>c.status==='todo'||c.status==='doing').reduce((s,c)=>s+Math.max(0,c.estimate-donePomodoros(a.state.focusSessions,c.id)),0),triaged=fresh.filter(c=>complete(row(c.id))).length;
 return <section className="panel fo-triage"><header className="section-heading"><div><h2>{triaged}/{fresh.length} cards triados</h2><p className="quiet-copy">Carga aberta: {load} 🍅</p></div>
   <div className="fo-row-end">{f.ai&&<button className="button outline small fo-ai-btn" disabled={running||applying} onClick={runAi}>{running?<LoaderCircle size={15} className="spin"/>:<Sparkles size={15}/>}Triar com IA</button>}
    {triaged===fresh.length&&<button className="button primary small" disabled={applying||running} onClick={applyAll}>{applying?<LoaderCircle size={15} className="spin"/>:<Check size={15}/>}Aplicar a triagem</button>}</div></header>
  <ul className="fo-triage-list">{fresh.map(c=>{const x=row(c.id);return <li key={c.id}><span className="fo-step" aria-label={x.step==='done'?'Pronto':x.step==='working'?'Trabalhando':'Pendente'}>{x.step==='done'?<Check size={16}/>:x.step==='working'?<LoaderCircle size={16} className="spin"/>:<Circle size={16}/>}</span>
    <div className="fo-triage-card"><button className="text-button" onClick={()=>f.open(c.id)}><b>{codeOf(c)}</b> {c.title}</button>{c.excerpt&&<small>{c.excerpt}</small>}</div>
    <div className="fo-triage-fields"><select aria-label={'Área de '+codeOf(c)} value={x.area} onChange={e=>edit(c.id,'area',e.target.value)}><option value="">Área</option>{AREAS.map(v=><option key={v} value={v}>{AREA_LABEL[v]}</option>)}</select>
     <select aria-label={'Prioridade de '+codeOf(c)} value={x.priority} onChange={e=>edit(c.id,'priority',e.target.value)}><option value="">Prioridade</option>{PRIORITIES.map(v=><option key={v} value={v}>{PRIORITY_LABEL[v]}</option>)}</select>
     <input type="number" min={1} max={12} placeholder="🍅" aria-label={'Estimativa de '+codeOf(c)} value={x.estimate} onChange={e=>edit(c.id,'estimate',e.target.value)}/></div></li>;})}</ul></section>;}

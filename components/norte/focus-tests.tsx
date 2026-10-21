'use client';
import {useState} from 'react';import {ChevronDown,Copy,Pencil,Plus,Trash2,Check,LoaderCircle} from 'lucide-react';
import {useApp} from './context';import {Modal} from './primitives';
import {TEST_KIND_LABEL,TEST_STATUS_LABEL,testsSummary,testsMarkdown,type Card,type TestCase,type TestKind,type TestStatus} from '@/lib/board';
// Casos de teste do card: status por caso, edição à mão e cópia em Markdown para levar ao Azure DevOps ou ao Jira.
const ICON:Record<TestStatus,string>={pending:'○',passed:'✓',failed:'✗'};
const plural=(n:number,one:string,many:string)=>n+' '+(n===1?one:many);
export function TestCases({card,onSave}:{card:Card;onSave:(tests:Partial<TestCase>[])=>Promise<boolean>}){const {toast}=useApp();const [open,setOpen]=useState<string|null>(null),[editing,setEditing]=useState<TestCase|'new'|null>(null);const s=testsSummary(card.tests);
 async function copy(){try{await navigator.clipboard.writeText(testsMarkdown(card));toast('Casos copiados.');}catch{toast('Não foi possível copiar. Confira a permissão do navegador.',true);}}
 return <div className="fo-tests">{card.tests.length>0&&<p className="fo-tests-sum">{plural(s.passed,'passou','passaram')} · {plural(s.failed,'falhou','falharam')} · {plural(s.pending,'pendente','pendentes')}</p>}
  {card.tests.length>0&&<ul className="fo-test-list">{card.tests.map(t=><li key={t.id} className={'fo-test '+t.status}><div className="fo-test-head">
   <button className="fo-test-toggle" aria-expanded={open===t.id} onClick={()=>setOpen(open===t.id?null:t.id)}><ChevronDown size={15}/><b>{t.code}</b><span className={'fo-kind '+t.kind}>{TEST_KIND_LABEL[t.kind]}</span><span className="fo-test-title">{t.title}</span></button>
   <select aria-label={'Status do '+t.code} value={t.status} onChange={e=>onSave(card.tests.map(x=>x.id===t.id?{...x,status:e.target.value as TestStatus}:x))}>{(['pending','passed','failed'] as TestStatus[]).map(k=><option key={k} value={k}>{ICON[k]} {TEST_STATUS_LABEL[k]}</option>)}</select>
   <button className="icon-button" aria-label={'Editar '+t.code} onClick={()=>setEditing(t)}><Pencil size={14}/></button><button className="icon-button" aria-label={'Excluir '+t.code} onClick={()=>onSave(card.tests.filter(x=>x.id!==t.id))}><Trash2 size={14}/></button></div>
   {open===t.id&&<div className="fo-test-body"><p><b>Pré-condição:</b> {t.precondition||'—'}</p><ol>{t.steps.map((x,i)=><li key={i}>{x}</li>)}</ol><p><b>Resultado esperado:</b> {t.expected}</p></div>}</li>)}</ul>}
  <div className="fo-row-end"><button className="button ghost small" disabled={!card.tests.length} onClick={copy}><Copy size={15}/>Copiar em Markdown</button><button className="button outline small" disabled={card.tests.length>=40} onClick={()=>setEditing('new')}><Plus size={15}/>Adicionar caso</button></div>
  {editing&&<TestForm test={editing==='new'?null:editing} onClose={()=>setEditing(null)} onSave={async draft=>{const next=editing==='new'?[...card.tests,draft]:card.tests.map(x=>x.id===(editing as TestCase).id?{...x,...draft}:x);if(await onSave(next))setEditing(null);}}/>}</div>;}
function TestForm({test,onClose,onSave}:{test:TestCase|null;onClose:()=>void;onSave:(d:Partial<TestCase>)=>Promise<void>}){
 const [v,setV]=useState({title:test?.title||'',kind:(test?.kind||'positive') as TestKind,precondition:test?.precondition||'',steps:(test?.steps||[]).join('\n'),expected:test?.expected||''}),[busy,setBusy]=useState(false);
 return <Modal title={test?'Editar '+test.code:'Novo caso de teste'} onClose={()=>!busy&&onClose()}><form onSubmit={async e=>{e.preventDefault();setBusy(true);await onSave({title:v.title,kind:v.kind,precondition:v.precondition,steps:v.steps.split('\n').map(x=>x.trim()).filter(Boolean),expected:v.expected});setBusy(false);}}><div className="form-grid">
  <label className="field full"><span>Título<i> *</i></span><input required maxLength={200} value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></label>
  <label className="field"><span>Tipo</span><select value={v.kind} onChange={e=>setV({...v,kind:e.target.value as TestKind})}>{(['positive','negative','edge'] as TestKind[]).map(k=><option key={k} value={k}>{TEST_KIND_LABEL[k]}</option>)}</select></label>
  <label className="field full"><span>Pré-condição</span><input maxLength={500} value={v.precondition} onChange={e=>setV({...v,precondition:e.target.value})}/></label>
  <label className="field full"><span>Passos<i> *</i></span><textarea required rows={4} value={v.steps} onChange={e=>setV({...v,steps:e.target.value})}/><small>Um passo por linha, até 12.</small></label>
  <label className="field full"><span>Resultado esperado<i> *</i></span><textarea required rows={2} maxLength={500} value={v.expected} onChange={e=>setV({...v,expected:e.target.value})}/></label></div>
  <footer className="modal-footer"><button type="button" className="button ghost" onClick={onClose} disabled={busy}>Cancelar</button><button className="button primary" disabled={busy}>{busy?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>}Salvar caso</button></footer></form></Modal>;}

'use client';
import {useRef,useState} from 'react';import {FileUp,LoaderCircle,Sparkles,Check} from 'lucide-react';
import {useApp} from './context';import {Modal} from './primitives';import {pdfText} from './fatura-pdf';
import {parseFaturaText,faturaFromLines,faturaItems,type FaturaResult,type FaturaRow} from '@/lib/fatura';import {EXPENSE_CATEGORIES,INCOME_CATEGORIES,budgetAlerts} from '@/lib/finance';
// Importar fatura: o PDF é lido no aparelho; "Ler com a IA" manda só o texto quando as regras não dão conta.
const ddmm=(d:string)=>d.slice(8,10)+'/'+d.slice(5,7);
type AiReply={error?:string;meta:Parameters<typeof faturaFromLines>[1];lines?:Parameters<typeof faturaFromLines>[0]};
export function FaturaImport({cardId='',money,onClose}:{cardId?:string;money:(cents:number)=>string;onClose:()=>void}){const a=useApp();
 const [card,setCard]=useState(cardId),[file,setFile]=useState<File|null>(null),[password,setPassword]=useState(''),[busy,setBusy]=useState<''|'reading'|'ai'|'saving'>(''),[error,setError]=useState(''),[result,setResult]=useState<FaturaResult|null>(null),[rows,setRows]=useState<FaturaRow[]>([]),text=useRef('');
 const ctx={transactions:a.state.transactions,today:a.today};
 const show=(r:FaturaResult)=>{setResult(r);setRows(r.rows);};
 async function read(e:React.FormEvent){e.preventDefault();if(!file)return;setError('');setBusy('reading');try{text.current=await pdfText(file,password.trim()||undefined);
  if(!text.current.trim()){setError('Este PDF não tem texto para ler (parece uma imagem). Baixe a fatura em PDF pelo app ou site do banco.');return;}
  show(parseFaturaText(text.current,ctx));}catch(err){setError(err instanceof Error?err.message:'Não consegui ler este PDF.');}finally{setBusy('');}}
 async function withAi(){setError('');setBusy('ai');try{const r=await fetch('/api/finance/fatura',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text.current})});const j:AiReply=await r.json().catch(()=>({}));if(!r.ok||!Array.isArray(j.lines))throw new Error(j.error||'Não consegui ler a fatura com a IA. Tente de novo.');show(faturaFromLines(j.lines,j.meta,ctx));}catch(err){setError(err instanceof Error&&!(err instanceof TypeError)?err.message:'Não consegui ler a fatura com a IA. Tente de novo.');}finally{setBusy('');}}
 const chosen=rows.filter(r=>r.selected),total=chosen.reduce((s,r)=>s+(r.direction==='income'?-r.amount:r.amount),0);
 const patch=(key:string,p:Partial<FaturaRow>)=>setRows(list=>list.map(r=>r.key===key?{...r,...p}:r));
 async function save(){const items=faturaItems(rows,card||undefined);if(!items.length)return;const alerts=budgetAlerts(a.state,items.map(item=>({collection:'transactions',item})));setBusy('saving');
  const ok=await a.mutate({type:'importTransactions',items});setBusy('');if(ok){a.toast([items.length+(items.length===1?' lançamento importado.':' lançamentos importados.'),...alerts].join(' '));onClose();}}
 const aiButton=<button type="button" className="button outline small" disabled={!!busy} onClick={withAi}>{busy==='ai'?<LoaderCircle className="spin" size={15}/>:<Sparkles size={15}/>}Ler com a IA</button>;
 return <Modal wide title="Importar fatura" subtitle="O PDF é lido no seu aparelho." onClose={()=>!busy&&onClose()}>
  {!result?<form onSubmit={read}><div className="form-grid">
   <label className="field full"><span>Cartão</span><select aria-label="Cartão" value={card} onChange={e=>setCard(e.target.value)}><option value="">Sem cartão</option>{a.state.cards.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
   <label className="field full"><span>Arquivo PDF</span><input aria-label="Arquivo PDF" type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   <label className="field full"><span>Senha do PDF (se tiver)</span><input aria-label="Senha do PDF" type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label></div>
   {error&&<p role="alert" className="form-error">{error}</p>}
   <footer className="modal-footer"><button type="button" className="button ghost" onClick={onClose} disabled={!!busy}>Cancelar</button><button className="button primary" disabled={!file||!!busy}>{busy==='reading'?<LoaderCircle className="spin" size={17}/>:<FileUp size={17}/>}{busy==='reading'?'Lendo…':'Ler fatura'}</button></footer></form>
  :<div className="fin-fatura">
   <p className="fin-fatura-meta">{result.issuer}{result.dueDate?' · vence '+ddmm(result.dueDate):''} · {rows.length} lidos · {chosen.length} selecionados · {money(total)}</p>
   {!rows.length&&<div className="fin-warning">Não achei lançamentos neste PDF. {aiButton}</div>}
   {rows.length>0&&result.mismatch&&result.total!==null&&<div className="fin-warning">A soma lida ({money(result.sum)}) não bate com o total da fatura ({money(result.total)}). Pode faltar alguma linha. {aiButton}</div>}
   {(!rows.length||result.mismatch)&&<p className="fin-fatura-note">Só o texto da fatura vai para a OpenAI para ser lido. Nada fica guardado.</p>}
   {result.truncated&&<p className="fin-fatura-note">Mostrando as 250 primeiras linhas.</p>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   {rows.length>0&&<><div className="fin-fatura-tools"><button type="button" className="button ghost small" onClick={()=>setRows(l=>l.map(r=>({...r,selected:true})))}>Marcar todos</button><button type="button" className="button ghost small" onClick={()=>setRows(l=>l.map(r=>({...r,selected:false})))}>Desmarcar todos</button></div>
    <ul className="fin-fatura-list">{rows.map(r=><li key={r.key} className={r.selected?'':'off'}><input type="checkbox" aria-label={'Lançar '+r.title} checked={r.selected} onChange={e=>patch(r.key,{selected:e.target.checked})}/><div>
     <p><span>{r.title}</span><b>{r.direction==='income'?'+ ':''}{money(r.amount)}</b></p>
     <div className="fin-fatura-tags"><time>{ddmm(r.date)}</time><select aria-label={'Categoria de '+r.title} value={r.category} onChange={e=>patch(r.key,{category:e.target.value})}>{(r.direction==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES).map(c=><option key={c} value={c}>{c}</option>)}</select>{r.installment&&<span className="pill">Parcela {r.installment}</span>}{r.duplicate&&<span className="pill warn">Já lançado</span>}{r.refund&&<span className="pill">Estorno</span>}</div>
     {r.reason&&<small>{r.reason}</small>}</div></li>)}</ul></>}
   <footer className="modal-footer"><button type="button" className="button ghost" onClick={onClose} disabled={!!busy}>Cancelar</button><button type="button" className="button primary" disabled={!chosen.length||!!busy} onClick={save}>{busy==='saving'?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>}Lançar {chosen.length}</button></footer></div>}
 </Modal>;}

'use client';
import {useRef,useState} from 'react';import {Upload,Pencil,RefreshCw,Trash2,Plus,X,LoaderCircle,FileText,TriangleAlert} from 'lucide-react';
import {useApp} from './context';import {Modal,Empty} from './primitives';
import {MARKER_KEYS,MAX_FILE_BYTES,FILE_TYPES,type Marker,type Overall} from '@/lib/exam-schema';
import {classifyMarker,finalOverall,parseDecimal,rangeText,valueText,STATUS_LABEL,OVERALL_LABEL,MARKER_LABEL,type MarkerStatus} from '@/lib/testosterone';
import type {Item,Workspace} from '@/lib/types';

type Saved={state:Workspace;version:number;exam?:Item;warning?:string};
type Row={key:string;label:string;qualifier:string;value:string;unit:string;refMin:string;refMax:string};
const NOTICE_KEY='geoai-exam-notice';
export const STATUS_PILL:Record<MarkerStatus,string>={low:'pill warn',high:'pill warn',normal:'pill green',none:'pill'};
export const OVERALL_PILL:Record<Overall,string>={ok:'pill green',attention:'pill warn',doctor:'pill danger'};
const dayLabel=(d:string)=>d.split('-').reverse().join('/');
const decimal=(n?:number)=>n===undefined?'':String(n).replace('.',',');
const emptyRow=():Row=>({key:'outro',label:'',qualifier:'',value:'',unit:'',refMin:'',refMax:''});
const toRows=(markers:Marker[]):Row[]=>markers.map(m=>({key:m.key,label:m.label,qualifier:m.qualifier||'',value:decimal(m.value),unit:m.unit||'',refMin:decimal(m.refMin),refMax:decimal(m.refMax)}));
function toMarkers(rows:Row[]){return rows.filter(r=>r.label.trim()||r.value.trim()).map(r=>{const label=r.label.trim()||MARKER_LABEL[r.key]||'Marcador';
 const num=(v:string,what:string)=>{if(!v.trim())return undefined;const n=parseDecimal(v);if(!Number.isFinite(n))throw new Error('Confira '+what+' de '+label+'.');return n;};
 const value=num(r.value,'o valor');if(value===undefined)throw new Error('Informe o valor de '+label+'.');
 return {key:r.key,label,value,...(r.qualifier?{qualifier:r.qualifier}:{}),...(r.unit.trim()?{unit:r.unit.trim()}:{}),...(r.refMin.trim()?{refMin:num(r.refMin,'a faixa mínima')}:{}),...(r.refMax.trim()?{refMax:num(r.refMax,'a faixa máxima')}:{})};});}
// Reduz fotos no navegador para caber no limite de envio; PDFs seguem como estão.
async function prepareFile(file:File):Promise<Blob>{if(!file.type.startsWith('image/'))return file;const bitmap=await createImageBitmap(file);const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);}bitmap.close();return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível preparar a foto.')),'image/jpeg',0.85));}
function useExamApi(){const a=useApp();return async function call(url:string,init:RequestInit):Promise<Saved>{const r=await fetch(url,init);const j=await r.json().catch(()=>({})) as Saved&{error?:string};if(!r.ok)throw new Error(j.error||'Não foi possível concluir agora.');a.sync(j);return j;};}

export function ExamsPanel(){const a=useApp(),call=useExamApi();const input=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(''),[notice,setNotice]=useState(false),[editing,setEditing]=useState<{id:string;warning?:string}|null>(null),[viewing,setViewing]=useState<string|null>(null);
 const exams=a.state.labExams.slice().sort((x,y)=>y.date.localeCompare(x.date));
 const fail=(e:unknown)=>a.toast(e instanceof Error?e.message:'Não foi possível concluir agora.',true);
 function choose(){let seen=false;try{seen=localStorage.getItem(NOTICE_KEY)==='1';}catch{}if(seen)input.current?.click();else setNotice(true);}
 async function upload(file:File){if(!(FILE_TYPES as readonly string[]).includes(file.type))return a.toast('Envie um PDF ou uma foto (JPEG, PNG ou WEBP).',true);setBusy('Lendo seu exame…');
  try{const body=await prepareFile(file);if(body.size>MAX_FILE_BYTES)throw new Error('Envie um arquivo de até 4 MB.');const form=new FormData();form.append('file',body,file.name);const j=await call('/api/exams',{method:'POST',body:form});if(j.exam)setEditing({id:j.exam.id,warning:j.warning});}
  catch(e){fail(e);}finally{setBusy('');if(input.current)input.current.value='';}}
 async function manual(){setBusy('Criando exame…');try{const j=await call('/api/exams',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(j.exam)setEditing({id:j.exam.id});}catch(e){fail(e);}finally{setBusy('');}}
 return <>
  <div className="section-action"><p>Envie o PDF ou a foto do laudo. A IA lê os valores e você confere antes do parecer.</p><div className="button-group"><button className="button outline" disabled={!!busy} onClick={manual}><Pencil size={16}/>Digitar exame</button><button className="button primary" disabled={!!busy} onClick={choose}>{busy?<LoaderCircle className="spin" size={16}/>:<Upload size={16}/>}{busy||'Enviar exame'}</button></div>
   <input ref={input} type="file" hidden accept={FILE_TYPES.join(',')} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);}}/></div>
  {exams.length?<div className="records-list">{exams.map(e=><ExamCard key={e.id} exam={e} all={a.state.labExams} onOpen={()=>e.status==='draft'?setEditing({id:e.id}):setViewing(e.id)}/>)}</div>
   :<section className="panel"><Empty title="Nenhum exame ainda" description="Envie seu último exame para acompanhar a evolução dos seus marcadores." action="Enviar exame" onAction={choose}/></section>}
  {notice&&<Modal title="Antes de enviar" subtitle="Seus exames, só seus." onClose={()=>setNotice(false)}><p className="modal-copy">Seus exames ficam guardados de forma privada. O arquivo é enviado à OpenAI apenas para leitura.</p><div className="modal-footer"><button className="button ghost" onClick={()=>setNotice(false)}>Cancelar</button><button className="button primary" onClick={()=>{try{localStorage.setItem(NOTICE_KEY,'1');}catch{}setNotice(false);input.current?.click();}}>Entendi, escolher arquivo</button></div></Modal>}
  {editing&&<ExamForm id={editing.id} warning={editing.warning} onClose={()=>setEditing(null)} onReviewed={id=>{setEditing(null);setViewing(id);}}/>}
  {viewing&&<ExamDetail id={viewing} onClose={()=>setViewing(null)} onEdit={id=>{setViewing(null);setEditing({id});}}/>}
 </>;}

function ExamCard({exam,all,onOpen}:{exam:Item;all:Item[];onOpen:()=>void}){const gender=useApp().state.profile.gender;const total=gender==='female'?undefined:(exam.markers as Marker[]|undefined)?.find(m=>m.key==='testosterona_total');const overall=exam.status==='reviewed'?finalOverall(exam,all,gender):null;
 return <article className="panel record-card"><div className="record-head"><span className={overall?OVERALL_PILL[overall]:'pill'}>{overall?OVERALL_LABEL[overall]:'Rascunho'}</span><time>{dayLabel(exam.date)}</time>{exam.file&&<FileText size={15} aria-label="Com arquivo"/>}</div>
  <button className="record-title" onClick={onOpen}>{exam.lab||exam.title}</button><p className="record-content">{total?'Testosterona total: '+valueText(total):exam.status==='draft'?'Confira os valores para gerar o parecer.':(exam.markers?.length||0)+' marcadores'}</p></article>;}

function ExamForm({id,warning,onClose,onReviewed}:{id:string;warning?:string;onClose:()=>void;onReviewed:(id:string)=>void}){const a=useApp(),call=useExamApi();const exam=a.state.labExams.find(e=>e.id===id);
 const [date,setDate]=useState(exam?.date||a.today),[lab,setLab]=useState(exam?.lab||''),[rows,setRows]=useState<Row[]>(()=>exam?.markers?.length?toRows(exam.markers):[a.state.profile.gender==='female'?{...emptyRow(),key:'estradiol',label:'Estradiol',unit:'pg/mL'}:{...emptyRow(),key:'testosterona_total',label:'Testosterona total',unit:'ng/dL'}]),[saving,setSaving]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
 if(!exam)return null;
 async function removeDraft(){setSaving(true);try{await call('/api/exams/'+id,{method:'DELETE'});a.toast('Exame excluído.');onClose();}catch(err){setError(err instanceof Error?err.message:'Não foi possível excluir.');setSaving(false);}}
 const set=(i:number,patch:Partial<Row>)=>setRows(rows.map((r,j)=>j===i?{...r,...patch}:r));
 async function submit(e:React.FormEvent){e.preventDefault();setError('');let markers;try{markers=toMarkers(rows);if(!markers.length)throw new Error('Informe pelo menos um marcador.');}catch(err){return setError(err instanceof Error?err.message:'Confira os valores.');}
  setSaving(true);try{const j=await call('/api/exams/'+id+'/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,lab,markers})});if(j.warning)a.toast(j.warning,true);onReviewed(id);}
  catch(err){setError(err instanceof Error?err.message:'Não foi possível salvar.');}finally{setSaving(false);}}
 return <Modal wide title="Confira os valores" subtitle={exam.file?'Lidos do arquivo '+exam.file.name+'. Corrija o que precisar.':'Digite os valores do laudo.'} onClose={()=>!saving&&onClose()}><form onSubmit={submit}>
  {warning&&<p className="form-error" role="alert"><TriangleAlert size={15}/> {warning}</p>}
  <div className="form-grid"><label className="field"><span>Data da coleta<i> *</i></span><input type="date" required max={a.today} value={date} onChange={e=>setDate(e.target.value)}/></label><label className="field"><span>Laboratório</span><input value={lab} maxLength={120} onChange={e=>setLab(e.target.value)}/></label></div>
  <div className="marker-rows">{rows.map((r,i)=><div className="marker-row" key={i}>
   <label className="wide"><span>Marcador</span><select value={r.key} onChange={e=>set(i,{key:e.target.value,label:r.label||MARKER_LABEL[e.target.value]||''})}>{MARKER_KEYS.map(k=><option key={k} value={k}>{MARKER_LABEL[k]}</option>)}</select></label>
   <label className="wide"><span>Nome no laudo</span><input value={r.label} maxLength={80} onChange={e=>set(i,{label:e.target.value})}/></label>
   <label><span>Sinal</span><select value={r.qualifier} onChange={e=>set(i,{qualifier:e.target.value})}><option value="">=</option><option value="<">&lt;</option><option value=">">&gt;</option></select></label>
   <label><span>Valor</span><input inputMode="decimal" value={r.value} onChange={e=>set(i,{value:e.target.value})}/></label>
   <label><span>Unidade</span><input value={r.unit} maxLength={30} onChange={e=>set(i,{unit:e.target.value})}/></label>
   <label><span>Mínimo</span><input inputMode="decimal" value={r.refMin} onChange={e=>set(i,{refMin:e.target.value})}/></label>
   <label><span>Máximo</span><input inputMode="decimal" value={r.refMax} onChange={e=>set(i,{refMax:e.target.value})}/></label>
   <button type="button" className="icon-button danger" aria-label={'Remover '+(r.label||'marcador')} onClick={()=>setRows(rows.filter((_,j)=>j!==i))}><X size={16}/></button></div>)}</div>
  <button type="button" className="button outline small" disabled={rows.length>=80} onClick={()=>setRows([...rows,emptyRow()])}><Plus size={15}/>Adicionar marcador</button>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {confirm?<div className="modal-footer"><span>Excluir este exame e o arquivo?</span><button type="button" className="button ghost" onClick={()=>setConfirm(false)} disabled={saving}>Cancelar</button><button type="button" className="button destructive" onClick={removeDraft} disabled={saving}>{saving?<LoaderCircle className="spin" size={16}/>:<Trash2 size={16}/>}Excluir</button></div>
  :<div className="modal-footer">{exam.status==='draft'&&<button type="button" className="button destructive" onClick={()=>setConfirm(true)} disabled={saving}><Trash2 size={16}/>Excluir rascunho</button>}<button type="button" className="button ghost" onClick={onClose} disabled={saving}>Fechar</button><button className="button primary" disabled={saving}>{saving?<><LoaderCircle className="spin" size={16}/>Gerando parecer…</>:'Salvar e revisar'}</button></div>}
 </form></Modal>;}

function ExamDetail({id,onClose,onEdit}:{id:string;onClose:()=>void;onEdit:(id:string)=>void}){const a=useApp(),call=useExamApi();const [busy,setBusy]=useState(''),[confirm,setConfirm]=useState(false);const exam=a.state.labExams.find(e=>e.id===id);
 if(!exam)return null;
 const overall=finalOverall(exam,a.state.labExams,a.state.profile.gender),review=exam.review;
 async function again(){setBusy('review');try{const j=await call('/api/exams/'+id+'/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:exam!.date,lab:exam!.lab||'',markers:exam!.markers})});a.toast(j.warning||'Parecer atualizado.',!!j.warning);}catch(e){a.toast(e instanceof Error?e.message:'Não foi possível revisar.',true);}finally{setBusy('');}}
 async function remove(){setBusy('delete');try{await call('/api/exams/'+id,{method:'DELETE'});a.toast('Exame excluído.');onClose();}catch(e){a.toast(e instanceof Error?e.message:'Não foi possível excluir.',true);setBusy('');}}
 return <Modal wide title={exam.lab||exam.title} subtitle={'Coleta em '+dayLabel(exam.date)} onClose={()=>!busy&&onClose()}>
  <p><span className={OVERALL_PILL[overall]}>{OVERALL_LABEL[overall]}</span></p>
  <div className="exam-markers">{(exam.markers as Marker[]).map((m,i)=>{const st=classifyMarker(m);return <div className="exam-marker" key={i}><div><strong>{m.label}</strong><small>Faixa: {rangeText(m)}</small></div><span>{valueText(m)}</span><span className={STATUS_PILL[st]}>{STATUS_LABEL[st]}</span></div>;})}</div>
  {review?<section><h3>Parecer</h3><p>{review.summary}</p>{review.points.length>0&&<><h4>Pontos de atenção</h4><ul className="review-list">{review.points.map((p:{marker:string;text:string},i:number)=><li key={i}><b>{p.marker}:</b> {p.text}</li>)}</ul></>}</section>:<p className="quiet-copy">Ainda sem parecer da IA. Toque em Revisar de novo.</p>}
  <p className="quiet-copy">A IA ajuda a entender seus exames, mas não substitui seu médico.</p>
  {confirm?<div className="modal-footer"><span>Excluir este exame e o arquivo?</span><button className="button ghost" onClick={()=>setConfirm(false)} disabled={!!busy}>Cancelar</button><button className="button destructive" onClick={remove} disabled={!!busy}>{busy==='delete'?<LoaderCircle className="spin" size={16}/>:<Trash2 size={16}/>}Excluir</button></div>
  :<div className="modal-footer">{exam.file&&<a className="button outline" href={'/api/exams/'+id+'/file'} target="_blank" rel="noreferrer"><FileText size={16}/>Ver arquivo</a>}<button className="button outline" onClick={()=>onEdit(id)} disabled={!!busy}><Pencil size={16}/>Editar valores</button><button className="button outline" onClick={again} disabled={!!busy}>{busy==='review'?<LoaderCircle className="spin" size={16}/>:<RefreshCw size={16}/>}Revisar de novo</button><button className="icon-button danger" aria-label="Excluir exame" onClick={()=>setConfirm(true)}><Trash2 size={16}/></button></div>}
 </Modal>;}

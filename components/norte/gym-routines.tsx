'use client';
import {useState} from 'react';
import {Plus,ArrowUp,ArrowDown,Link2,Unlink,Trash2,Copy,Pencil,Printer,Check,ChevronRight,Sparkles,X} from 'lucide-react';
import {WEEKDAY_LONG,PROGRESSIONS,PROGRESSION_LABEL,PROGRESSION_HINT,ICONS,fmtWeight,type Routine,type RoutineItem,type Progression,type RoutineIcon} from '@/lib/gym';
import {exerciseOf,defaultIncrement} from '@/lib/gym-catalog';
import {orderedWeekdays,rotationNext} from '@/lib/gym-plan';
import {Modal,Empty} from './primitives';
import {useGym} from './gym-context';
import {Icon,ICON_LABEL,Segmented,Switch,Stepper,ExercisePicker,MuscleChips,musclesWorked,fmtSecs,plural} from './gym-ui';
import {StarterPlans} from './gym-today';
const uid=()=>crypto.randomUUID();
export const describeItem=(i:RoutineItem)=>i.timeSec?i.sets+' × '+fmtSecs(i.timeSec):i.sets+' × '+(i.repMax?i.reps+'–'+i.repMax:i.reps);

export function PlanTab(){const g=useGym(),p=g.view!.profile;const [tab,setTab]=useState<'agenda'|'rotinas'>(p.routines.length?'agenda':'rotinas'),[editing,setEditing]=useState<Routine|null>(null),[starters,setStarters]=useState(false);
 const newRoutine=()=>setEditing({id:uid(),name:'',icon:'dumbbell',progression:'double',deload:false,items:[]});
 return <>
  <div className="gy-plan-head"><Segmented label="Parte do plano" value={tab} onChange={setTab} options={[['agenda','Agenda'],['rotinas','Rotinas']]}/><div className="button-group"><button className="button outline small" onClick={()=>setStarters(true)}><Sparkles size={15}/>Planos prontos</button><button className="button primary small" onClick={newRoutine}><Plus size={15}/>Nova rotina</button></div></div>
  {tab==='agenda'?<Schedule onEdit={setEditing}/>:<RoutineList onEdit={setEditing} onNew={newRoutine}/>}
  {editing&&<RoutineEditor key={editing.id} routine={editing} isNew={!p.routines.some(r=>r.id===editing.id)} onClose={()=>setEditing(null)}/>}
  {starters&&<Modal title="Planos prontos" subtitle="As rotinas entram como qualquer outra: dá para editar, trocar exercícios e mudar os dias. A semana passa a seguir o plano escolhido." eyebrow="PLANO" wide onClose={()=>setStarters(false)}><StarterPlans onDone={()=>{setStarters(false);setTab('agenda');}}/></Modal>}
 </>;}

function Schedule({onEdit}:{onEdit:(r:Routine)=>void}){const g=useGym(),view=g.view!,p=view.profile,s=p.schedule;
 if(!p.routines.length)return <section className="panel"><Empty title="Nenhuma rotina ainda" description="Crie uma rotina ou escolha um plano pronto para montar a sua semana."/></section>;
 const next=s.mode==='rotation'?rotationNext(p,view.workouts):null;
 return <section className="panel gy-schedule">
  <div className="gy-schedule-mode"><Segmented label="Como você treina" value={s.mode} onChange={mode=>g.profile({type:'schedule',schedule:{mode}})} options={[['week','Semana fixa'],['rotation','Rotação']]}/>
   <p className="quiet-copy">{s.mode==='week'?'As mesmas rotinas nos mesmos dias, toda semana.':'Uma fila: o próximo treino é o seguinte ao último que você fez, em qualquer dia.'}</p></div>
  {s.mode==='week'?<><ul className="gy-days">{orderedWeekdays(s.weekStart).map(d=>{const r=p.routines.find(x=>x.id===s.days[d]);return <li key={d}><span>{WEEKDAY_LONG[d]}</span>
    <select aria-label={'Rotina de '+WEEKDAY_LONG[d]} value={s.days[d]||''} onChange={e=>g.profile({type:'schedule',schedule:{days:{[d]:e.target.value||null}}})}><option value="">Descanso</option>{p.routines.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>
    {r?<button className="icon-button" onClick={()=>onEdit(r)} aria-label={'Editar '+r.name}><Pencil size={15}/></button>:<span className="gy-days-gap"/>}</li>;})}</ul>
   <label className="field gy-inline-field"><span>A semana começa</span><select value={s.weekStart} onChange={e=>g.profile({type:'schedule',schedule:{weekStart:e.target.value as 'mon'|'sun'}})}><option value="mon">na segunda</option><option value="sun">no domingo</option></select></label></>
  :<><ol className="gy-rotation">{s.rotation.map((id,i)=>{const r=p.routines.find(x=>x.id===id);if(!r)return null;return <li key={id+i} className={next?.id===id?'next':''}><b>{String.fromCharCode(65+i)}</b><span>{r.name}{next?.id===id&&<small>próximo</small>}</span>
     <button className="icon-button" disabled={i===0} aria-label="Subir" onClick={()=>{const list=[...s.rotation];[list[i-1],list[i]]=[list[i],list[i-1]];g.profile({type:'schedule',schedule:{rotation:list}});}}><ArrowUp size={15}/></button>
     <button className="icon-button" aria-label="Tirar da fila" onClick={()=>g.profile({type:'schedule',schedule:{rotation:s.rotation.filter((_,k)=>k!==i)}})}><X size={15}/></button></li>;})}</ol>
   {!s.rotation.length&&<p className="quiet-copy">A fila está vazia. Adicione as rotinas na ordem em que quer treinar.</p>}
   <label className="field gy-inline-field"><span>Adicionar à fila</span><select value="" onChange={e=>{if(e.target.value)g.profile({type:'schedule',schedule:{rotation:[...s.rotation,e.target.value]}});}}><option value="">Escolha uma rotina…</option>{p.routines.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></>}
 </section>;}

function RoutineList({onEdit,onNew}:{onEdit:(r:Routine)=>void;onNew:()=>void}){const g=useGym(),p=g.view!.profile;
 if(!p.routines.length)return <section className="panel"><Empty title="Sua primeira rotina" description="Uma rotina é a lista de exercícios de um treino, com séries, reps e descanso." action="Nova rotina" onAction={onNew}/></section>;
 const days=(id:string)=>orderedWeekdays(p.schedule.weekStart).filter(d=>p.schedule.days[d]===id).map(d=>WEEKDAY_LONG[d].slice(0,3));
 return <div className="gy-routines">{p.routines.map((r,i)=><article key={r.id} className="panel gy-routine"><button className="gy-routine-main" onClick={()=>onEdit(r)}><span className="gy-today-icon"><Icon name={r.icon}/></span><span><strong>{r.name}</strong><small>{plural(r.items.length,'exercício','exercícios')}{days(r.id).length?' · '+days(r.id).join(', '):''} · {PROGRESSION_LABEL[r.progression]}</small><span className="gy-chips">{musclesWorked(r.items.map(x=>exerciseOf(x.exerciseId,p.custom))).slice(0,4).map(m=><span key={m} className="gy-chip">{m}</span>)}</span></span><ChevronRight size={18}/></button>
  <div className="gy-routine-actions"><button className="icon-button" disabled={i===0} aria-label={'Subir '+r.name} onClick={()=>{const ids=p.routines.map(x=>x.id);[ids[i-1],ids[i]]=[ids[i],ids[i-1]];g.profile({type:'reorder',ids});}}><ArrowUp size={15}/></button><button className="icon-button" disabled={i===p.routines.length-1} aria-label={'Descer '+r.name} onClick={()=>{const ids=p.routines.map(x=>x.id);[ids[i+1],ids[i]]=[ids[i],ids[i+1]];g.profile({type:'reorder',ids});}}><ArrowDown size={15}/></button></div></article>)}</div>;}

function RoutineEditor({routine,isNew,onClose}:{routine:Routine;isNew:boolean;onClose:()=>void}){const g=useGym(),p=g.view!.profile;
 const [r,setR]=useState<Routine>(routine),[picker,setPicker]=useState(false),[item,setItem]=useState<RoutineItem|null>(null),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false);
 const items=(f:(list:RoutineItem[])=>RoutineItem[])=>setR(x=>{const list=f([...x.items]);if(list[0])list[0]={...list[0],superset:false};return {...x,items:list};});
 const move=(i:number,d:number)=>items(l=>{const j=i+d;if(j<0||j>=l.length)return l;[l[i],l[j]]=[l[j],l[i]];return l;});
 const save=async()=>{if(!r.name.trim())return;setBusy(true);const ok=await g.profile({type:'routine',routine:r});setBusy(false);if(ok)onClose();};
 const copy=async()=>{const c={...r,id:uid(),name:(r.name+' (cópia)').slice(0,60),items:r.items.map(i=>({...i,id:uid()}))};if(await g.profile({type:'routine',routine:c}))onClose();};
 const print=()=>{const w=window.open('','_blank');if(!w)return;const esc=(s:string)=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
  w.document.write('<!doctype html><meta charset="utf-8"><title>'+esc(r.name)+'</title><style>body{font:14px system-ui;margin:32px;color:#222}h1{font-size:22px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}table{border-collapse:collapse;width:100%}</style><h1>'+esc(r.name)+'</h1><table><tr><th>Exercício</th><th>Séries × reps</th><th>Descanso</th><th>Notas</th></tr>'+r.items.map(i=>'<tr><td>'+(i.superset?'↳ ':'')+esc(exerciseOf(i.exerciseId,p.custom)?.name||'')+'</td><td>'+describeItem(i)+'</td><td>'+fmtSecs(i.restSec??p.settings.restSec)+'</td><td>'+esc(i.notes)+'</td></tr>').join('')+'</table><p>GeoAI · Gym</p>');w.document.close();w.print();};
 return <Modal title={isNew?'Nova rotina':'Editar rotina'} eyebrow="ROTINA" wide onClose={onClose} className="gy-editor">
  <div className="form-grid"><label className="field"><span>Nome</span><input autoFocus={isNew} maxLength={60} value={r.name} placeholder="Ex.: Peito e tríceps" onChange={e=>setR({...r,name:e.target.value})}/></label>
   <label className="field"><span>Ícone</span><select value={r.icon} onChange={e=>setR({...r,icon:e.target.value as RoutineIcon})}>{ICONS.map(i=><option key={i} value={i}>{ICON_LABEL[i]}</option>)}</select></label></div>
  <label className="field"><span>Progressão</span><select value={r.progression} onChange={e=>setR({...r,progression:e.target.value as Progression})}>{PROGRESSIONS.map(x=><option key={x} value={x}>{PROGRESSION_LABEL[x]}</option>)}</select><small className="gy-hint">{PROGRESSION_HINT[r.progression]} Vale para todos os exercícios desta rotina que não tenham regra própria.</small></label>
  <Switch label="Rotina de deload" hint="Os treinos dela ficam no histórico, mas não mexem na progressão." checked={r.deload} onChange={deload=>setR({...r,deload})}/>
  <div className="section-action"><h3>Exercícios</h3><button className="button outline small" onClick={()=>setPicker(true)}><Plus size={15}/>Adicionar</button></div>
  {r.items.length?<ol className="gy-items">{r.items.map((it,i)=>{const e=exerciseOf(it.exerciseId,p.custom);return <li key={it.id} className={it.superset?'linked':''}>
   <button className="gy-item-main" onClick={()=>setItem(it)}><strong>{e?.name||'Exercício removido'}</strong><small>{describeItem(it)} · descanso {fmtSecs(it.restSec??p.settings.restSec)}{it.weight?' · '+fmtWeight(it.weight,p.settings.unit):''}{it.progression?' · '+PROGRESSION_LABEL[it.progression]:''}</small></button>
   <div className="gy-item-actions">{i>0&&<button className={'icon-button'+(it.superset?' active':'')} aria-pressed={it.superset} aria-label={it.superset?'Separar do exercício de cima':'Fazer em superset com o de cima'} title={it.superset?'Separar do de cima':'Superset com o de cima'} onClick={()=>items(l=>{l[i]={...l[i],superset:!l[i].superset};return l;})}>{it.superset?<Unlink size={15}/>:<Link2 size={15}/>}</button>}
    <button className="icon-button" disabled={i===0} aria-label="Subir" onClick={()=>move(i,-1)}><ArrowUp size={15}/></button><button className="icon-button" disabled={i===r.items.length-1} aria-label="Descer" onClick={()=>move(i,1)}><ArrowDown size={15}/></button><button className="icon-button" aria-label={'Tirar '+(e?.name||'')} onClick={()=>items(l=>l.filter(x=>x.id!==it.id))}><Trash2 size={15}/></button></div></li>;})}</ol>
  :<p className="quiet-copy">Nenhum exercício ainda. Toque em Adicionar.</p>}
  {r.items.length>0&&<p className="gy-chips gy-hits"><b>Trabalha:</b>{musclesWorked(r.items.map(x=>exerciseOf(x.exerciseId,p.custom))).slice(0,8).map(m=><span key={m} className="gy-chip">{m}</span>)}</p>}
  <div className="modal-footer gy-editor-foot">{!isNew&&<><button className="button ghost small" onClick={copy}><Copy size={15}/>Copiar</button><button className="button ghost small" onClick={print}><Printer size={15}/>Imprimir</button><button className="button ghost small danger-text" onClick={()=>setConfirm(true)}><Trash2 size={15}/>Excluir</button></>}
   <span className="gy-grow"/><button className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy||!r.name.trim()} onClick={save}><Check size={16}/>{isNew?'Criar rotina':'Salvar'}</button></div>
  {picker&&<ExercisePicker title="Adicionar à rotina" multiple onClose={()=>setPicker(false)} onPick={e=>items(l=>[...l,{id:uid(),exerciseId:e.id,sets:3,reps:e.timed?1:8,repMax:e.timed||r.progression!=='double'?null:12,timeSec:e.timed?30:null,weight:null,restSec:null,superset:false,increment:null,progression:e.timed?'time':null,backupId:null,notes:''}])}/>}
  {item&&<ItemEditor item={item} onClose={()=>setItem(null)} onSave={x=>{items(l=>l.map(y=>y.id===x.id?x:y));setItem(null);}}/>}
  {confirm&&<Modal title="Excluir esta rotina?" subtitle={r.name} eyebrow="ROTINA" onClose={()=>setConfirm(false)}><p className="modal-copy">Ela sai da agenda e da rotação. Os treinos que você já fez com ela continuam no histórico.</p><div className="modal-footer"><button className="button ghost" onClick={()=>setConfirm(false)}>Manter</button><button className="button destructive" onClick={async()=>{if(await g.profile({type:'deleteRoutine',id:r.id}))onClose();}}>Excluir rotina</button></div></Modal>}
 </Modal>;}

function ItemEditor({item,onSave,onClose}:{item:RoutineItem;onSave:(i:RoutineItem)=>void;onClose:()=>void}){const g=useGym(),p=g.view!.profile,unit=p.settings.unit,e=exerciseOf(item.exerciseId,p.custom);
 const [x,setX]=useState<RoutineItem>(item),[timed,setTimed]=useState(!!item.timeSec),[range,setRange]=useState(!!item.repMax),[backup,setBackup]=useState(false);const b=x.backupId?exerciseOf(x.backupId,p.custom):null;
 return <Modal title={e?.name||'Exercício'} eyebrow="NA ROTINA" onClose={onClose}><MuscleChips exercise={e}/>
  <Segmented label="Medir por" value={timed?'time':'reps'} onChange={v=>{setTimed(v==='time');setX({...x,timeSec:v==='time'?x.timeSec||30:null,reps:v==='time'?1:Math.max(1,x.reps)});}} options={[['reps','Repetições'],['time','Tempo']]}/>
  <div className="gy-item-grid"><label><span>Séries</span><Stepper label="Séries" value={x.sets} step={1} min={1} max={20} decimals={0} onChange={v=>setX({...x,sets:v||1})}/></label>
   {timed?<label><span>Segundos</span><Stepper label="Tempo em segundos" value={x.timeSec} step={5} min={5} max={7200} decimals={0} onChange={v=>setX({...x,timeSec:v||30})}/></label>
   :<><label><span>{range?'Reps de':'Reps'}</span><Stepper label="Repetições" value={x.reps} step={1} min={1} max={100} decimals={0} onChange={v=>setX({...x,reps:v||1,repMax:x.repMax&&x.repMax<(v||1)?v:x.repMax})}/></label>{range&&<label><span>até</span><Stepper label="Topo da faixa" value={x.repMax} step={1} min={x.reps} max={100} decimals={0} onChange={v=>setX({...x,repMax:v})}/></label>}</>}
   <label><span>Descanso (s)</span><Stepper label="Descanso em segundos" value={x.restSec??p.settings.restSec} step={15} min={0} max={900} decimals={0} onChange={v=>setX({...x,restSec:v})}/></label>
   <label><span>Carga inicial ({unit})</span><Stepper label="Carga inicial" value={x.weight} unit={unit} step={unit==='lb'?5:2.5} max={unit==='lb'?2200:1000} onChange={v=>setX({...x,weight:v})}/></label></div>
  {!timed&&<Switch label="Faixa de repetições" hint="Ex.: 8 a 12. Usada pela progressão dupla." checked={range} onChange={v=>{setRange(v);setX({...x,repMax:v?Math.max(x.reps+4,x.repMax||0):null});}}/>}
  <label className="field"><span>Progressão deste exercício</span><select value={x.progression||''} onChange={ev=>setX({...x,progression:(ev.target.value||null) as Progression|null})}><option value="">A da rotina</option>{PROGRESSIONS.map(v=><option key={v} value={v}>{PROGRESSION_LABEL[v]}</option>)}</select></label>
  <label className="field"><span>Incremento ({unit})</span><Stepper label="Incremento" value={x.increment??defaultIncrement(e)} unit={unit} step={unit==='lb'?2.5:0.5} max={50} onChange={v=>setX({...x,increment:v})}/><small className="gy-hint">Quanto a carga sobe quando a progressão manda subir.</small></label>
  <div className="field"><span>Exercício reserva</span><div className="button-group">{b?<span className="gy-chip main">{b.name}</span>:<small className="gy-hint">Para quando o aparelho estiver ocupado.</small>}<button className="button outline small" onClick={()=>setBackup(true)}>{b?'Trocar':'Escolher'}</button>{b&&<button className="button ghost small" onClick={()=>setX({...x,backupId:null})}>Tirar</button>}</div></div>
  <label className="field"><span>Nota</span><input maxLength={300} value={x.notes} placeholder="Ex.: banco no furo 3" onChange={ev=>setX({...x,notes:ev.target.value})}/></label>
  <div className="modal-footer"><button className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" onClick={()=>onSave(x)}><Check size={16}/>Aplicar</button></div>
  {backup&&<ExercisePicker title="Exercício reserva" onClose={()=>setBackup(false)} onPick={n=>{setX({...x,backupId:n.id});setBackup(false);}}/>}
 </Modal>;}

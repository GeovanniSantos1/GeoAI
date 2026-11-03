'use client';
import {useMemo,useState} from 'react';
import {Plus,Pencil,Trash2,Repeat,Check,X,NotebookPen} from 'lucide-react';
import {toUnit,fmtNumber,isDate} from '@/lib/gym';
import {volumeOf,type Workout,type GymSet} from '@/lib/gym-active';
import {exerciseOf,bodyweight} from '@/lib/gym-catalog';
import {workSets,recordsIn} from '@/lib/gym-stats';
import {Modal,Empty} from './primitives';
import {useApp} from './context';
import {useGym} from './gym-context';
import {WorkoutRow} from './gym-today';
import {WorkoutSummary,effortLabel} from './gym-workout';
import {Stepper,ExercisePicker,fmtDate,fmtMinutes,fmtVolume,fmtSecs,plural} from './gym-ui';
const uid=()=>crypto.randomUUID();
const monthLabel=(ym:string)=>new Date(ym+'-15T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});

export function HistoryTab({onOpen}:{onOpen:(w:Workout)=>void}){const g=useGym(),app=useApp(),view=g.view!;const [editing,setEditing]=useState<Workout|null>(null);
 const months=useMemo(()=>{const m=new Map<string,Workout[]>();for(const w of view.workouts){const k=w.date.slice(0,7);m.set(k,[...(m.get(k)||[]),w]);}return [...m.entries()];},[view.workouts]);
 // Sessões antigas do menu Treinos (antes do Gym) continuam visíveis; as "gym-" são espelho dos treinos daqui.
 const legacy=app.state.sessions.filter(s=>!String(s.id).startsWith('gym-')).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const blank=():Workout=>({id:uid(),routineId:null,name:'Treino',date:g.today,startedAt:new Date(g.today+'T12:00:00').toISOString(),durationMin:45,notes:'',noProgression:false,exercises:[],prs:0,rev:1});
 return <>
  <div className="section-action gy-top"><h2>{plural(view.workouts.length,'treino','treinos')}{view.next&&!g.full?' recentes':''}</h2><div className="button-group">{view.next&&!g.full&&<button className="button ghost small" onClick={g.loadAll}>Carregar todos</button>}<button className="button outline small" onClick={()=>setEditing(blank())}><Plus size={15}/>Lançar treino feito</button></div></div>
  {!view.workouts.length&&!legacy.length&&<section className="panel"><Empty title="Seu histórico começa no primeiro treino" description="Finalize um treino no Gym ou lance um que você fez no papel." action="Lançar treino feito" onAction={()=>setEditing(blank())}/></section>}
  {months.map(([ym,list])=><section key={ym} className="gy-month"><h3>{monthLabel(ym)}<small>{plural(list.length,'treino','treinos')} · {fmtVolume(list.reduce((v,w)=>v+volumeOf(w),0),view.profile.settings.unit)}</small></h3><div className="gy-recent">{list.map(w=><WorkoutRow key={w.id} w={w} onOpen={()=>onOpen(w)}/>)}</div></section>)}
  {legacy.length>0&&<section className="gy-month"><h3>Registros simples<small>do menu Treinos, antes do Gym</small></h3><div className="gy-recent">{legacy.slice(0,30).map(s=><div key={s.id} className="panel gy-row static"><span className="gy-row-date"><b>{Number(String(s.date).slice(8))}</b><small>{fmtDate(s.date,{month:'short'})}</small></span><span className="gy-row-main"><strong>{s.title}</strong><small>{s.duration?fmtMinutes(s.duration):''}{s.notes?' · '+s.notes:''}</small></span></div>)}</div></section>}
  {editing&&<WorkoutEditor workout={editing} isNew onClose={()=>setEditing(null)}/>}
 </>;}

export function WorkoutDetail({workout,onClose}:{workout:Workout;onClose:()=>void}){const g=useGym(),view=g.view!,unit=view.profile.settings.unit,effort=view.profile.settings.effort;
 const [mode,setMode]=useState<'view'|'edit'|'delete'|'summary'>('view');const live=view.workouts.find(w=>w.id===workout.id)||workout;const records=recordsIn(live,view.workouts);
 const fmtSet=(s:GymSet)=>(s.kind==='warmup'?'Aq. ':s.kind==='drop'?'Drop ':s.kind==='burst'?'RP ':'')+(s.weight?fmtNumber(toUnit(s.weight,unit),1)+' '+unit+' × ':'')+(s.timeSec?fmtSecs(s.timeSec):(s.reps??0)+' reps')+(s.effort!==null&&effort!=='off'?' · '+effortLabel(s.effort,effort):'');
 if(mode==='edit')return <WorkoutEditor workout={live} isNew={false} onClose={onClose}/>;
 if(mode==='summary')return <WorkoutSummary workout={live} onClose={onClose}/>;
 return <Modal title={live.name} subtitle={fmtDate(live.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · '+fmtMinutes(live.durationMin)} eyebrow="TREINO" wide onClose={onClose}>
  <div className="gy-summary"><div><small>Volume</small><strong>{fmtVolume(volumeOf(live),unit)}</strong></div><div><small>Séries</small><strong>{live.exercises.reduce((n,e)=>n+workSets(e.sets).length,0)}</strong></div><div><small>Exercícios</small><strong>{live.exercises.length}</strong></div><div><small>Recordes</small><strong>{records.length||'–'}</strong></div></div>
  {live.notes&&<p className="gy-note"><NotebookPen size={14}/>{live.notes}</p>}
  <ul className="gy-detail">{live.exercises.map((e,i)=><li key={i}><strong>{exerciseOf(e.exerciseId,view.profile.custom)?.name||'Exercício removido'}{records.includes(e.exerciseId)&&<span className="gy-pr-badge">Recorde</span>}</strong>{e.notes&&<small>{e.notes}</small>}<ol>{e.sets.map(s=><li key={s.id}>{fmtSet(s)}</li>)}</ol></li>)}</ul>
  {mode==='delete'?<div className="modal-footer"><span className="gy-grow">Excluir este treino? Recordes e progressão são recalculados sem ele.</span><button className="button ghost" onClick={()=>setMode('view')}>Manter</button><button className="button destructive" onClick={async()=>{if(await g.removeWorkout(live.id))onClose();}}>Excluir</button></div>
  :<div className="modal-footer gy-editor-foot"><button className="button ghost small danger-text" onClick={()=>setMode('delete')}><Trash2 size={15}/>Excluir</button><span className="gy-grow"/><button className="button outline small" disabled={!!view.active} title={view.active?'Finalize o treino em andamento antes':undefined} onClick={async()=>{if(await g.start(null,{name:live.name,from:live}))onClose();}}><Repeat size={15}/>Repetir hoje</button><button className="button primary small" onClick={()=>setMode('edit')}><Pencil size={15}/>Editar</button></div>}
 </Modal>;}

// Lançar um treino feito no papel ou corrigir um salvo: data, hora, duração, exercícios e séries.
function WorkoutEditor({workout,isNew,onClose}:{workout:Workout;isNew:boolean;onClose:()=>void}){const g=useGym(),view=g.view!,unit=view.profile.settings.unit;
 const [w,setW]=useState<Workout>(()=>structuredClone(workout)),[picker,setPicker]=useState(false),[busy,setBusy]=useState(false);
 const time=new Date(w.startedAt).toTimeString().slice(0,5);
 const setTime=(date:string,hhmm:string)=>{const d=new Date(date+'T'+(hhmm||'12:00')+':00');setW(x=>({...x,date,startedAt:isNaN(d.getTime())?x.startedAt:d.toISOString()}));};
 const ex=(i:number,f:(sets:GymSet[])=>GymSet[])=>setW(x=>({...x,exercises:x.exercises.map((e,k)=>k===i?{...e,sets:f([...e.sets])}:e)}));
 const valid=isDate(w.date)&&w.date<=g.today&&w.exercises.some(e=>e.sets.length)&&w.name.trim().length>0;
 const save=async()=>{setBusy(true);const clean={...w,exercises:w.exercises.map(e=>({...e,sets:e.sets.filter(s=>s.reps||s.timeSec||s.weight)})).filter(e=>e.sets.length)};const saved=await g.saveWorkout(clean,isNew);setBusy(false);if(saved)onClose();};
 return <Modal title={isNew?'Lançar treino feito':'Editar treino'} subtitle={isNew?'Para um treino que você fez sem o app aberto.':'Recordes e progressão são recalculados com a correção.'} eyebrow="HISTÓRICO" wide onClose={onClose} className="gy-editor">
  <div className="form-grid"><label className="field"><span>Nome</span><input maxLength={60} value={w.name} onChange={e=>setW({...w,name:e.target.value})}/></label><label className="field"><span>Data</span><input type="date" max={g.today} value={w.date} onChange={e=>setTime(e.target.value,time)}/></label>
   <label className="field"><span>Início</span><input type="time" value={time} onChange={e=>setTime(w.date,e.target.value)}/></label><label className="field"><span>Duração (min)</span><input type="number" min={1} max={600} value={w.durationMin} onChange={e=>setW({...w,durationMin:Math.max(1,Math.min(600,Number(e.target.value)||1))})}/></label></div>
  {w.exercises.map((e,i)=>{const info=exerciseOf(e.exerciseId,view.profile.custom),timed=!!info?.timed;return <section key={i} className="gy-edit-ex"><header><strong>{info?.name||'Exercício removido'}</strong><button className="icon-button" aria-label="Tirar exercício" onClick={()=>setW(x=>({...x,exercises:x.exercises.filter((_,k)=>k!==i)}))}><X size={15}/></button></header>
   {e.sets.map((s,j)=><div key={s.id} className="gy-edit-set"><span>{j+1}</span><Stepper label={'Peso da série '+(j+1)} value={s.weight} unit={unit} step={unit==='lb'?5:bodyweight(info)?1:2.5} onChange={v=>ex(i,l=>l.map(y=>y.id===s.id?{...y,weight:v}:y))} compact/>
    {timed?<Stepper label={'Tempo da série '+(j+1)} value={s.timeSec} step={5} decimals={0} max={7200} onChange={v=>ex(i,l=>l.map(y=>y.id===s.id?{...y,timeSec:v}:y))} compact/>:<Stepper label={'Reps da série '+(j+1)} value={s.reps} step={1} decimals={0} max={500} onChange={v=>ex(i,l=>l.map(y=>y.id===s.id?{...y,reps:v}:y))} compact/>}
    <button className="icon-button" aria-label={'Remover série '+(j+1)} onClick={()=>ex(i,l=>l.filter(y=>y.id!==s.id))}><Trash2 size={14}/></button></div>)}
   <button className="gy-add-set" onClick={()=>ex(i,l=>{const last=l[l.length-1];return [...l,{id:uid(),kind:'work',weight:last?.weight??null,reps:timed?null:last?.reps??10,timeSec:timed?last?.timeSec??30:null,effort:null,done:true,doneAt:w.startedAt}];})}><Plus size={14}/>Série</button></section>;})}
  <button className="button outline full-width" onClick={()=>setPicker(true)}><Plus size={16}/>Adicionar exercício</button>
  <label className="field gy-gap"><span>Nota</span><textarea rows={2} maxLength={600} value={w.notes} onChange={e=>setW({...w,notes:e.target.value})}/></label>
  <div className="modal-footer"><span className="gy-grow gy-hint">{w.date>g.today?'A data não pode ser no futuro.':!w.exercises.some(e=>e.sets.length)?'Adicione pelo menos uma série.':''}</span><button className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy||!valid} onClick={save}><Check size={16}/>Salvar</button></div>
  {picker&&<ExercisePicker title="Adicionar exercício" multiple onClose={()=>setPicker(false)} onPick={e=>setW(x=>({...x,exercises:[...x.exercises,{exerciseId:e.id,notes:'',sets:[{id:uid(),kind:'work',weight:null,reps:e.timed?null:10,timeSec:e.timed?30:null,effort:null,done:true,doneAt:x.startedAt}]}]}))}/>}
 </Modal>;}

'use client';
import {useMemo,useState} from 'react';
import {Search,Star,Plus,Check,Sparkles,Trophy,Trash2,Download,PersonStanding,X} from 'lucide-react';
import {fmtWeight,toUnit,fmtNumber,type CustomExercise} from '@/lib/gym';
import {searchExercises,BODY_PARTS,EQUIPMENT,MUSCLES,CATEGORIES,LEVELS,type Exercise} from '@/lib/gym-catalog';
import {sessionsOf,bestOf,e1rm,workSets} from '@/lib/gym-stats';
import {Modal} from './primitives';
import {useGym} from './gym-context';
import {MuscleChips,Switch,fmtDate,fmtSecs,plural} from './gym-ui';
import {BodyMap} from './gym-body';
import {levelOfExercises,SLUG_MUSCLE,MUSCLE_SLUGS} from '@/lib/gym-muscles';
import {workoutsCsv,gymJson} from '@/lib/gym-export';
import {useApp} from './context';
import {describeItem} from './gym-routines';

export function LibraryTab(){const g=useGym(),app=useApp(),p=g.view!.profile;
 const [muscle,setMuscle]=useState(''),[explore,setExplore]=useState(false);
 const [query,setQuery]=useState(''),[part,setPart]=useState(''),[equipment,setEquipment]=useState(''),[fav,setFav]=useState(false),[limit,setLimit]=useState(60),[open,setOpen]=useState<Exercise|null>(null),[create,setCreate]=useState(false);
 const list=useMemo(()=>searchExercises(g.exercises,{query,part,muscle,equipment,favorites:p.favorites,onlyFavorites:fav}),[g.exercises,query,part,muscle,equipment,p.favorites,fav]);
 const done=useMemo(()=>{const m=new Map<string,number>();for(const w of g.view!.workouts)for(const e of w.exercises)m.set(e.exerciseId,(m.get(e.exerciseId)||0)+1);return m;},[g.view]);
 return <>
  <div className="gy-lib-head"><label className="search-field gy-search"><Search size={18}/><input value={query} onChange={e=>{setQuery(e.target.value);setLimit(60);}} placeholder={'Buscar entre '+g.exercises.length+' exercícios'} aria-label="Buscar exercício"/></label><div className="button-group"><button className={'button outline'+(explore?' active':'')} aria-pressed={explore} onClick={()=>setExplore(v=>!v)}><PersonStanding size={16}/>Por músculo</button><button className="button outline" onClick={()=>setCreate(true)}><Plus size={16}/>Criar exercício</button></div></div>
  {explore&&<section className="panel gy-explore"><p className="quiet-copy">Toque num músculo para ver os exercícios que o trabalham.</p><BodyMap level={muscle?Object.fromEntries((MUSCLE_SLUGS[muscle]||[]).map(([s,w])=>[s,w])):{}} gender={app.state.profile.gender} size="lg" onPick={slug=>{setMuscle(m=>m===SLUG_MUSCLE[slug]?'':SLUG_MUSCLE[slug]);setPart('');setLimit(60);}} label="Escolha um músculo"/>{muscle&&<button className="gy-filter active" onClick={()=>setMuscle('')}>{MUSCLES[muscle]}<X size={13}/></button>}</section>}
  <div className="gy-lib-tail">
  <div className="gy-filter-row"><button className={'gy-filter'+(fav?' active':'')} aria-pressed={fav} onClick={()=>setFav(v=>!v)}><Star size={13}/>Favoritos</button>{BODY_PARTS.map(b=><button key={b.id} className={'gy-filter'+(part===b.id?' active':'')} aria-pressed={part===b.id} onClick={()=>{setPart(x=>x===b.id?'':b.id);setLimit(60);}}>{b.label}</button>)}
   <select className="gy-filter-select" aria-label="Equipamento" value={equipment} onChange={e=>setEquipment(e.target.value)}><option value="">Todo equipamento</option>{Object.entries(EQUIPMENT).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
  </div>
  <p className="gy-count" role="status">{list.length?plural(list.length,'exercício','exercícios')+(muscle?' para '+MUSCLES[muscle]:''):'Nada encontrado. Tente outra palavra ou tire um filtro.'}</p>
  <ul className="gy-lib">{list.slice(0,limit).map(e=><li key={e.id} className="panel"><button className="gy-lib-main" onClick={()=>setOpen(e)}><strong>{e.name}{e.custom&&<span className="pill">seu</span>}</strong><MuscleChips exercise={e} limit={3}/>{done.get(e.id)?<small>{plural(done.get(e.id)!,'treino','treinos')}</small>:null}</button>
   <button className={'icon-button gy-star'+(p.favorites.includes(e.id)?' on':'')} aria-pressed={p.favorites.includes(e.id)} aria-label={(p.favorites.includes(e.id)?'Tirar dos':'Pôr nos')+' favoritos: '+e.name} onClick={()=>g.profile({type:'favorite',exerciseId:e.id,on:!p.favorites.includes(e.id)})}><Star size={16}/></button></li>)}</ul>
  {list.length>limit&&<button className="button outline full-width" onClick={()=>setLimit(l=>l+60)}>Mostrar mais</button>}
  <p className="quiet-copy gy-credit">Lista de exercícios baseada na free-exercise-db (domínio público). Nomes e passos em português escritos para o GeoAI.</p>
  {open&&<ExerciseDetail exercise={open} onClose={()=>setOpen(null)}/>}{create&&<CustomEditor onClose={()=>setCreate(false)}/>}
 </>;}

export function ExerciseDetail({exercise:e,onClose}:{exercise:Exercise;onClose:()=>void}){const g=useGym(),app=useApp(),view=g.view!,p=view.profile,unit=p.settings.unit;
 const sessions=useMemo(()=>sessionsOf(view.workouts,e.id),[view.workouts,e.id]),best=bestOf(sessions);const [add,setAdd]=useState(false);
 const inRoutines=p.routines.filter(r=>r.items.some(i=>i.exerciseId===e.id));
 return <Modal title={e.name} subtitle={[EQUIPMENT[e.equipment],CATEGORIES[e.category],LEVELS[e.level]].filter(Boolean).join(' · ')} eyebrow="EXERCÍCIO" wide onClose={onClose}>
  <div className="gy-ex-top"><BodyMap level={levelOfExercises([{exercise:e}])} gender={app.state.profile.gender} size="md" label={'Músculos: '+[...e.primary,...e.secondary].map(m=>MUSCLES[m]||m).join(', ')}/><MuscleChips exercise={e} limit={8}/></div>
  {best&&<div className="gy-summary"><div><small>Melhor série</small><strong>{best.weight?fmtWeight(best.weight,unit)+' × '+best.reps:best.timeSec?fmtSecs(best.timeSec):best.reps+' reps'}</strong></div><div><small>1RM estimado</small><strong>{best.e1rm?fmtWeight(best.e1rm,unit):'–'}</strong></div><div><small>Treinos</small><strong>{sessions.length}</strong></div><div><small>Última vez</small><strong>{fmtDate(sessions[0].date,{day:'numeric',month:'short'})}</strong></div></div>}
  {e.steps.length>0&&<><h4 className="gy-sub">Como fazer</h4><ol className="gy-steps">{e.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>{e.tip&&<p className="gy-tip"><Sparkles size={14}/>{e.tip}</p>}</>}
  {sessions.length>0&&<><h4 className="gy-sub">Seu histórico</h4><ul className="gy-history-mini">{sessions.slice(0,8).map(h=>{const top=Math.max(...workSets(h.sets).map(s=>e1rm(s.weight,s.reps)));return <li key={h.workoutId}><time>{fmtDate(h.date)}</time><span>{workSets(h.sets).map(s=>(s.weight?fmtNumber(toUnit(s.weight,unit),1)+'×':'')+(s.timeSec?fmtSecs(s.timeSec):s.reps)).join(' · ')}</span><small>{top>0?'1RM '+fmtWeight(top,unit):''}{best&&h.date===best.date?<Trophy size={12}/>:null}</small></li>;})}</ul></>}
  {inRoutines.length>0&&<p className="quiet-copy">Está em: {inRoutines.map(r=>r.name+' ('+describeItem(r.items.find(i=>i.exerciseId===e.id)!)+')').join(', ')}.</p>}
  <p className="quiet-copy">Os passos descrevem o movimento e não substituem a orientação de um profissional.</p>
  <div className="modal-footer gy-editor-foot">{e.custom&&<button className="button ghost small danger-text" onClick={async()=>{if(await g.profile({type:'deleteCustom',id:e.id}))onClose();}}><Trash2 size={15}/>Excluir</button>}<span className="gy-grow"/>
   <button className="button ghost" onClick={()=>g.profile({type:'favorite',exerciseId:e.id,on:!p.favorites.includes(e.id)})}><Star size={16}/>{p.favorites.includes(e.id)?'Favorito':'Favoritar'}</button>
   {p.routines.length>0&&<button className="button primary" onClick={()=>setAdd(true)}><Plus size={16}/>Adicionar a uma rotina</button>}</div>
  {add&&<Modal title="Adicionar a qual rotina?" subtitle={e.name} eyebrow="ROTINA" onClose={()=>setAdd(false)}><div className="gy-start-list">{p.routines.map(r=><button key={r.id} className="gy-start" onClick={async()=>{
   const item={id:crypto.randomUUID(),exerciseId:e.id,sets:3,reps:e.timed?1:8,repMax:e.timed||r.progression!=='double'?null:12,timeSec:e.timed?30:null,weight:null,restSec:null,superset:false,increment:null,progression:e.timed?'time' as const:null,backupId:null,notes:''};
   if(await g.profile({type:'routine',routine:{...r,items:[...r.items,item]}})){setAdd(false);onClose();}}}><span><strong>{r.name}</strong><small>{plural(r.items.length,'exercício','exercícios')}</small></span><Plus size={17}/></button>)}</div></Modal>}
 </Modal>;}

function CustomEditor({onClose}:{onClose:()=>void}){const g=useGym();const [c,setC]=useState<CustomExercise>({id:'c-'+crypto.randomUUID().slice(0,18),name:'',equipment:'machine',primary:[],secondary:[],category:'strength',timed:false}),[busy,setBusy]=useState(false);
 const toggle=(m:string,key:'primary'|'secondary')=>setC(x=>{const other=key==='primary'?'secondary':'primary';const on=x[key].includes(m);return {...x,[key]:on?x[key].filter(y=>y!==m):[...x[key],m].slice(0,6),[other]:x[other].filter(y=>y!==m)};});
 return <Modal title="Criar exercício" subtitle="Para o aparelho da sua academia ou uma variação que não está na lista." eyebrow="EXERCÍCIO" wide onClose={onClose}>
  <div className="form-grid"><label className="field"><span>Nome</span><input autoFocus maxLength={60} value={c.name} placeholder="Ex.: Remada no aparelho articulado" onChange={e=>setC({...c,name:e.target.value})}/></label>
   <label className="field"><span>Equipamento</span><select value={c.equipment} onChange={e=>setC({...c,equipment:e.target.value})}>{Object.entries(EQUIPMENT).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
  <div className="field"><span>Músculos principais</span><div className="gy-filter-row">{Object.entries(MUSCLES).map(([m,l])=><button key={m} type="button" className={'gy-filter'+(c.primary.includes(m)?' active':'')} aria-pressed={c.primary.includes(m)} onClick={()=>toggle(m,'primary')}>{l}</button>)}</div></div>
  <div className="field"><span>Músculos secundários (opcional)</span><div className="gy-filter-row">{Object.entries(MUSCLES).filter(([m])=>!c.primary.includes(m)).map(([m,l])=><button key={m} type="button" className={'gy-filter'+(c.secondary.includes(m)?' active':'')} aria-pressed={c.secondary.includes(m)} onClick={()=>toggle(m,'secondary')}>{l}</button>)}</div></div>
  <Switch label="Por tempo" hint="Para isometria, prancha ou cardio: as séries contam segundos, não reps." checked={c.timed} onChange={timed=>setC({...c,timed})}/>
  <div className="modal-footer"><button className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy||!c.name.trim()||!c.primary.length} onClick={async()=>{setBusy(true);const ok=await g.profile({type:'custom',exercise:c});setBusy(false);if(ok)onClose();}}><Check size={16}/>Criar</button></div></Modal>;}

export function GymSettingsTab(){const g=useGym(),s=g.view!.profile.settings;const set=(settings:Partial<typeof s>)=>g.profile({type:'settings',settings});
 return <section className="panel gy-settings">
  <div className="gy-set-row"><span><strong>Unidade de peso</strong><small>Os pesos ficam guardados em kg; a troca só muda como aparecem.</small></span><select value={s.unit} onChange={e=>set({unit:e.target.value as 'kg'|'lb'})}><option value="kg">Quilos (kg)</option><option value="lb">Libras (lb)</option></select></div>
  <div className="gy-set-row"><span><strong>Esforço por série</strong><small>RIR: reps que ainda sairiam. RPE: de 1 a 10. Desligado esconde a coluna.</small></span><select value={s.effort} onChange={e=>set({effort:e.target.value as 'rir'|'rpe'|'off'})}><option value="rir">RIR</option><option value="rpe">RPE</option><option value="off">Desligado</option></select></div>
  <div className="gy-set-row"><span><strong>Descanso padrão</strong><small>Para exercícios sem descanso próprio na rotina.</small></span><select value={s.restSec} onChange={e=>set({restSec:Number(e.target.value)})}>{[0,30,45,60,75,90,120,150,180,240,300].map(v=><option key={v} value={v}>{v?fmtSecs(v):'Sem descanso'}</option>)}</select></div>
  <Switch label="Som no fim do descanso" checked={s.sound} onChange={sound=>set({sound})}/>
  <Switch label="Vibrar no fim do descanso" hint="No celular, quando o navegador permite." checked={s.vibrate} onChange={vibrate=>set({vibrate})}/>
  <Switch label="Manter a tela acesa durante o treino" checked={s.keepAwake} onChange={keepAwake=>set({keepAwake})}/>
  <h4 className="gy-sub">Barra e anilhas</h4>
  <div className="gy-set-row"><span><strong>Peso da barra</strong><small>Usado na conta das anilhas e no aquecimento.</small></span><select value={s.bar} onChange={e=>set({bar:Number(e.target.value)})}>{([[0,'Sem barra (Smith, máquina)'],[10,'10 kg'],[15,'15 kg (feminina)'],[20,'20 kg (olímpica)'],[20.41,'45 lb']] as [number,string][]).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
  <Switch label="Mostrar as anilhas por lado" hint="Nos exercícios com barra, a conta aparece embaixo das séries." checked={s.plates} onChange={plates=>set({plates})}/>
  <Switch label="Aquecimento automático" hint="Nos compostos com barra: só a barra, 40%, 60% e 80% da carga antes das séries de trabalho." checked={s.warmups} onChange={warmups=>set({warmups})}/>
  <h4 className="gy-sub">Seus dados</h4><ExportRow/>
 </section>;}
// Exporta o histórico inteiro: CSV para planilha (uma linha por série) ou JSON com tudo.
function ExportRow(){const g=useGym();const [busy,setBusy]=useState(false);
 const save=async(kind:'csv'|'json')=>{setBusy(true);await g.loadAll();setBusy(false);const v=g.view!;const now=new Date();
  const text=kind==='csv'?workoutsCsv(v.workouts,v.profile):gymJson(v.workouts,v.profile,now);const url=URL.createObjectURL(new Blob([kind==='csv'?'\ufeff'+text:text],{type:kind==='csv'?'text/csv;charset=utf-8':'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='geoai-gym-'+g.today+'.'+kind;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
 return <div className="gy-set-row"><span><strong>Exportar treinos</strong><small>CSV abre em planilhas (uma linha por série); JSON leva também as rotinas e os ajustes.</small></span><div className="button-group"><button className="button outline small" disabled={busy} onClick={()=>save('csv')}><Download size={15}/>CSV</button><button className="button outline small" disabled={busy} onClick={()=>save('json')}><Download size={15}/>JSON</button></div></div>;}

'use client';
import {useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,Play,Repeat,Moon,Plus,Scale,Trophy,Flame,CalendarCheck,Dumbbell,Check,Sparkles} from 'lucide-react';
import {fmtWeight,fmtNumber,WEEKDAY_SHORT,shiftDate,type Routine,type StarterKey} from '@/lib/gym';
import {volumeOf,type Workout} from '@/lib/gym-active';
import {exerciseOf} from '@/lib/gym-catalog';
import {todayOf,weekOf,STARTERS} from '@/lib/gym-plan';
import {weekStreak,workoutSets,totals} from '@/lib/gym-stats';
import {lastWeight} from '@/lib/hydration';
import {Modal,Stat} from './primitives';
import {useApp} from './context';
import {useGym} from './gym-context';
import {Icon,fmtDate,fmtMinutes,fmtVolume,plural,musclesWorked,Stepper} from './gym-ui';
import {BodyMap} from './gym-body';
import {levelOfExercises} from '@/lib/gym-muscles';

export function TodayTab({onPlan,onWorkout}:{onPlan:()=>void;onWorkout:(w:Workout)=>void}){const g=useGym(),app=useApp(),view=g.view!,p=view.profile,unit=p.settings.unit;
 const [offset,setOffset]=useState(0),[sheet,setSheet]=useState(false),[weigh,setWeigh]=useState(false);
 const today=todayOf(p,view.workouts,g.today),week=weekOf(p,view.workouts,g.today,offset),done=week.filter(d=>d.status==='done').length,planned=week.filter(d=>d.routine).length;
 const streak=weekStreak(view.workouts.map(w=>w.date),g.today,p.schedule.weekStart),t=totals(view.workouts,g.today);
 const month=view.workouts.filter(w=>w.date.startsWith(g.today.slice(0,7)));
 if(!p.routines.length)return <><section className="panel gy-welcome"><span className="eyebrow">COMECE AQUI</span><h2>Monte seu treino em um minuto</h2><p>Escolha um plano pronto (dá para mudar tudo depois) ou comece com um treino livre e vá adicionando os exercícios.</p>
  <StarterPlans/><div className="button-group"><button className="button outline" onClick={onPlan}><Plus size={16}/>Montar do zero</button><button className="button ghost" onClick={()=>g.start(null)}><Play size={16}/>Treino livre agora</button></div></section>
  <BodyWeightCard onLog={()=>setWeigh(true)}/>{weigh&&<WeighIn onClose={()=>setWeigh(false)}/>}</>;
 const cta=view.active?<button className="button primary" onClick={()=>g.setOpen(true)}><Play size={16}/>Voltar ao treino</button>:null;
 return <>
  <section className="panel gy-week"><header><button className="icon-button" onClick={()=>setOffset(o=>o-1)} aria-label="Semana anterior"><ChevronLeft size={18}/></button><strong>{offset===0?'Esta semana':offset===-1?'Semana passada':offset===1?'Próxima semana':fmtDate(week[0].date,{day:'numeric',month:'short'})+' a '+fmtDate(week[6].date,{day:'numeric',month:'short'})}</strong><button className="icon-button" onClick={()=>setOffset(o=>o+1)} aria-label="Próxima semana"><ChevronRight size={18}/></button></header>
   <ol>{week.map(d=><li key={d.date} className={'st-'+d.status+(d.today?' today':'')} title={d.routine?.name||(d.status==='done'?'Treino feito':'Descanso')}><span>{WEEKDAY_SHORT[d.weekday]}</span><b>{Number(d.date.slice(8))}</b><i aria-hidden/><span className="sr-only">{d.status==='done'?'treino feito':d.status==='planned'?'planejado: '+d.routine?.name:d.status==='missed'?'não treinou':'descanso'}</span></li>)}</ol>
   <p className="gy-week-foot">{planned?done+' de '+planned+' treinos nesta semana':plural(done,'treino','treinos')+' nesta semana'}</p></section>
  {today.kind==='routine'&&<section className="panel gy-today"><div className="gy-today-icon"><Icon name={today.routine.icon} size={22}/></div><div className="gy-today-main"><span className="eyebrow">{today.done?'HOJE · FEITO':today.moved?'HOJE · REMARCADO':'TREINO DE HOJE'}</span><h2>{today.routine.name}</h2>
    <p>{plural(today.routine.items.length,'exercício','exercícios')} · {musclesWorked(today.routine.items.map(i=>exerciseOf(i.exerciseId,p.custom))).slice(0,4).join(', ')||'sem exercícios ainda'}</p></div>
   <BodyMap level={levelOfExercises(today.routine.items.map(i=>({exercise:exerciseOf(i.exerciseId,p.custom),sets:i.sets})))} gender={app.state.profile.gender} size="xs" label={'Músculos de '+today.routine.name}/>
   <div className="gy-today-actions">{cta||(today.done?<button className="button outline" onClick={()=>setSheet(true)}><Plus size={16}/>Treinar de novo</button>:<button className="button primary" onClick={()=>g.start(today.routine)} disabled={!today.routine.items.length}><Play size={16}/>Começar</button>)}<button className="text-button" onClick={()=>setSheet(true)}><Repeat size={14}/>Escolher outro treino</button></div></section>}
  {today.kind==='rest'&&<section className="panel gy-today rest"><div className="gy-today-icon"><Moon size={22}/></div><div className="gy-today-main"><span className="eyebrow">{today.done?'HOJE · TREINO FEITO':'HOJE É DESCANSO'}</span><h2>{today.done?'Missão cumprida':'Recuperar também é treino'}</h2>
    <p>{today.next?'Próximo: '+today.next.routine.name+' '+(today.next.date===shiftDate(g.today,1)?'amanhã':'na '+fmtDate(today.next.date,{weekday:'long'})):'Nada planejado nos próximos dias.'}</p></div>
   <div className="gy-today-actions">{cta||<button className="button outline" onClick={()=>setSheet(true)}><Play size={16}/>Treinar mesmo assim</button>}</div></section>}
  <div className="stats-grid three gy-stats"><Stat label="Semanas seguidas" value={streak} icon={Flame} foot={streak?'com pelo menos um treino':'treine esta semana para começar'}/><Stat label="Treinos no mês" value={t.month} icon={CalendarCheck} foot={fmtVolume(month.reduce((v,w)=>v+volumeOf(w),0),unit)+' levantados'}/><Stat label="Treinos no total" value={t.workouts} icon={Dumbbell} foot={fmtMinutes(t.minutes)+' treinando'}/></div>
  <BodyWeightCard onLog={()=>setWeigh(true)}/>
  <div className="section-action"><h2>Últimos treinos</h2></div>
  {view.workouts.length?<div className="gy-recent">{view.workouts.slice(0,4).map(w=><WorkoutRow key={w.id} w={w} onOpen={()=>onWorkout(w)}/>)}</div>:<p className="quiet-copy">Seu primeiro treino aparece aqui assim que você finalizar.</p>}
  {sheet&&<StartSheet onClose={()=>setSheet(false)}/>}{weigh&&<WeighIn onClose={()=>setWeigh(false)}/>}
 </>;}

export function WorkoutRow({w,onOpen}:{w:Workout;onOpen:()=>void}){const g=useGym(),unit=g.view!.profile.settings.unit;
 return <button className="panel gy-row" onClick={onOpen}><span className="gy-row-date"><b>{Number(w.date.slice(8))}</b><small>{fmtDate(w.date,{month:'short'})}</small></span><span className="gy-row-main"><strong>{w.name}</strong><small>{fmtDate(w.date,{weekday:'long'})} · {fmtMinutes(w.durationMin)} · {plural(workoutSets(w),'série','séries')} · {fmtVolume(volumeOf(w),unit)}</small></span>{w.prs>0&&<span className="gy-pr-badge"><Trophy size={12}/>{w.prs}</span>}</button>;}

export function StarterPlans({onDone}:{onDone?:()=>void}){const g=useGym();const [busy,setBusy]=useState<StarterKey|null>(null);
 return <div className="gy-starters">{STARTERS.map(s=><button key={s.key} className="gy-starter" disabled={!!busy} onClick={async()=>{setBusy(s.key);const ok=await g.profile({type:'starter',key:s.key,seed:crypto.randomUUID().replace(/-/g,'').slice(0,12)});setBusy(null);if(ok)onDone?.();}}>
  <strong>{s.label}</strong><small>{s.description}</small><span>{s.routines.join(' · ')}</span><em>{plural(s.days,'dia','dias')} por semana{busy===s.key?' · criando…':''}</em></button>)}</div>;}

// Escolher o que treinar agora: o planejado de hoje, outra rotina ou treino livre.
export function StartSheet({onClose}:{onClose:()=>void}){const g=useGym(),view=g.view!,p=view.profile,today=todayOf(p,view.workouts,g.today);const [swap,setSwap]=useState(false);
 // Com 'remarcar', a rotina escolhida fica no lugar da de hoje (a semana não muda); sem, é só um treino a mais.
 const go=async(r:Routine|null)=>{if(swap&&r&&!await g.profile({type:'move',date:g.today,routineId:r.id}))return;if(await g.start(r))onClose();};const planned=today.kind==='routine'?today.routine:null;
 return <Modal title="Começar treino" subtitle={planned?'Hoje está planejado '+planned.name+'.':'Nada planejado para hoje.'} eyebrow="TREINAR" onClose={onClose}>
  <div className="gy-start-list">{planned&&<button className="gy-start primary" onClick={()=>go(planned)}><Icon name={planned.icon}/><span><strong>{planned.name}</strong><small>Planejado para hoje · {plural(planned.items.length,'exercício','exercícios')}</small></span><Play size={17}/></button>}
   {p.routines.filter(r=>r.id!==planned?.id).map(r=><button key={r.id} className="gy-start" onClick={()=>go(r)} disabled={!r.items.length}><Icon name={r.icon}/><span><strong>{r.name}</strong><small>{plural(r.items.length,'exercício','exercícios')}</small></span><Play size={17}/></button>)}
   <button className="gy-start" onClick={()=>go(null)}><Sparkles size={18}/><span><strong>Treino livre</strong><small>Escolha os exercícios na hora</small></span><Play size={17}/></button></div>
  {p.routines.length>1&&<label className="gy-menu-check"><input type="checkbox" checked={swap} onChange={e=>setSwap(e.target.checked)}/><span><strong>Remarcar: a escolhida substitui a de hoje</strong><small>Só hoje muda. A semana planejada continua igual.</small></span></label>}
  <p className="quiet-copy">Sem remarcar, treinar outra rotina não muda a sua semana.</p></Modal>;}

function BodyWeightCard({onLog}:{onLog:()=>void}){const app=useApp(),g=useGym(),unit=g.view!.profile.settings.unit;
 const list=useMemo(()=>app.state.measurements.filter(m=>typeof m.weight==='number'&&m.weight>0).sort((a,b)=>String(a.date).localeCompare(String(b.date))),[app.state.measurements]);
 const last=list[list.length-1],prev=list[list.length-2],delta=last&&prev?Math.round((last.weight-prev.weight)*10)/10:null;
 return <section className="panel gy-weight"><div><span className="eyebrow">PESO CORPORAL</span>{last?<><strong>{fmtWeight(last.weight,unit)}</strong><small>{fmtDate(last.date)}{delta!==null&&delta!==0?' · '+(delta>0?'+':'')+fmtNumber(delta)+' kg desde a anterior':''}</small></>:<><strong>Sem pesagem</strong><small>Registre para acompanhar a tendência e usar nos cálculos.</small></>}</div>
  <button className="button outline small" onClick={onLog}><Scale size={15}/>Registrar peso</button></section>;}
// Pesagem rápida: grava em Peso & medidas do GeoAI (o mesmo peso que a meta de água e a Testosterona usam).
export function WeighIn({onClose}:{onClose:()=>void}){const app=useApp(),g=useGym(),unit=g.view!.profile.settings.unit;
 const start=lastWeight(app.state,g.today)??70;const [kg,setKg]=useState<number|null>(start),[busy,setBusy]=useState(false);
 const save=async()=>{if(!kg||kg<20||kg>400){app.toast('Informe um peso entre 20 e 400 kg.',true);return;}setBusy(true);const same=app.state.measurements.find(m=>m.date===g.today);
  const ok=await app.mutate({type:'upsert',collection:'measurements',item:{...(same||{}),id:same?.id,title:same?.title||'Peso',date:g.today,weight:Math.round(kg*10)/10}});setBusy(false);if(ok){app.toast('Peso registrado.');onClose();}};
 return <Modal title="Pesagem rápida" subtitle="Fica em Peso & medidas, junto com as suas outras medidas." eyebrow="PESO" onClose={onClose}>
  <div className="gy-weigh"><Stepper label="Peso corporal" value={kg} unit={unit} step={0.1} decimals={1} min={20} max={unit==='lb'?880:400} onChange={setKg}/><span>{unit}</span></div>
  <div className="gy-weigh-quick">{[-1,-0.5,0.5,1].map(d=><button key={d} className="button outline small" onClick={()=>setKg(v=>Math.round(((v||0)+(unit==='lb'?d*0.45359237:d))*100)/100)}>{d>0?'+':'−'}{Math.abs(d).toLocaleString('pt-BR')}</button>)}</div>
  <div className="modal-footer"><button className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy} onClick={save}><Check size={16}/>Salvar</button></div></Modal>;}

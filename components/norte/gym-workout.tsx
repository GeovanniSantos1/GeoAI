'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,ChevronLeft,ChevronRight,MoreHorizontal,Plus,Check,Trophy,TrendingUp,TrendingDown,Pause,Play,SkipForward,Timer,Trash2,Repeat,NotebookPen,BookOpen,History,ArrowUp,ArrowDown,Pencil,Sparkles,X} from 'lucide-react';
import {fmtWeight,fmtNumber,toUnit,type Effort} from '@/lib/gym';
import {doneSets,totalSets,volumeOf,restLeft,groupOf,SET_KIND_LABEL,SET_KINDS,type ActiveExercise,type GymSet,type Workout,type SetKind} from '@/lib/gym-active';
import {exerciseOf,bodyweight,defaultIncrement,EQUIPMENT,type Exercise} from '@/lib/gym-catalog';
import {sessionsOf,bestOf,heaviestOf,isRecord,e1rm,recordsIn,workSets} from '@/lib/gym-stats';
import {looseExercise} from '@/lib/gym-plan';
import {platesFor,KG_PLATES,LB_PLATES} from '@/lib/gym-plates';
import {levelOfExercises} from '@/lib/gym-muscles';
import {BodyMap} from './gym-body';
import {useApp} from './context';
import {Modal} from './primitives';
import {useGym} from './gym-context';
import {Stepper,MuscleChips,ExercisePicker,fmtClock,fmtMinutes,fmtVolume,fmtDate,fmtSecs,plural,musclesWorked} from './gym-ui';
const uid=()=>crypto.randomUUID();
// Esforço fica guardado como RIR (reps que sobravam); quem prefere RPE vê 10 − RIR.
export const RIR_LEVELS:[number,string][]=[[0,'Falha: não sairia mais nenhuma'],[1,'Sobrava 1 rep'],[2,'Sobravam 2 reps'],[3,'Sobravam 3 reps'],[4,'Sobravam 4 reps'],[5,'5 ou mais: bem leve']];
export const effortLabel=(rir:number|null,scale:Effort)=>rir===null||scale==='off'?'':scale==='rpe'?'RPE '+fmtNumber(10-rir):'RIR '+fmtNumber(rir);
const effortTone=(rir:number)=>rir<=0?'t0':rir<=1?'t1':rir<=2?'t2':rir<=3?'t3':'t4';
// Relógio da tela: atualiza a cada segundo sem ler o horário durante o render.
function useNow(ms=1000){const [now,setNow]=useState(0);useEffect(()=>{const tick=()=>setNow(Date.now());const t0=setTimeout(tick,0),t=setInterval(tick,ms);return()=>{clearTimeout(t0);clearInterval(t);};},[ms]);return now;}
let audio:AudioContext|null=null;
// O navegador só libera som depois de um toque: o primeiro "feito" desbloqueia; o fim do descanso toca três bipes curtos.
function unlockAudio(){try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();}catch{}}
function beep(){if(!audio)return;try{const t=audio.currentTime;for(let i=0;i<3;i++){const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=880;g.gain.setValueAtTime(.0001,t+i*.28);g.gain.exponentialRampToValueAtTime(.3,t+i*.28+.02);g.gain.exponentialRampToValueAtTime(.0001,t+i*.28+.2);o.connect(g).connect(audio.destination);o.start(t+i*.28);o.stop(t+i*.28+.22);}}catch{}}

export function GymWorkout(){const g=useGym(),a=g.view?.active,settings=g.view?.profile.settings,now=useNow();
 const [menu,setMenu]=useState<'options'|'finish'|'add'|'note'|'rename'|null>(null),[flash,setFlash]=useState(false);
 const rest=a?.rest??null,left=restLeft(rest,now||0);
 // Fim do descanso: som, vibração e um piscar da tela, uma vez por descanso e só com a aba visível.
 const alerted=useRef('');useEffect(()=>{if(!rest?.endsAt||!settings)return;const key=rest.endsAt,ms=Date.parse(rest.endsAt)-Date.now();if(ms<-3000)return;
  const t=setTimeout(()=>{if(alerted.current===key||document.visibilityState!=='visible')return;alerted.current=key;if(settings.sound)beep();if(settings.vibrate)navigator.vibrate?.([220,90,220]);setFlash(true);setTimeout(()=>setFlash(false),1200);},Math.max(0,ms));return()=>clearTimeout(t);},[rest?.endsAt,settings]);
 // Tela acesa enquanto o treino está aberto (quando o navegador permite).
 useEffect(()=>{if(!g.open||!settings?.keepAwake||!('wakeLock' in navigator))return;let lock:WakeLockSentinel|null=null,gone=false;
  const take=()=>{if(document.visibilityState==='visible')navigator.wakeLock.request('screen').then(l=>{if(gone)l.release();else lock=l;}).catch(()=>{});};take();document.addEventListener('visibilitychange',take);
  return()=>{gone=true;document.removeEventListener('visibilitychange',take);lock?.release().catch(()=>{});};},[g.open,settings?.keepAwake]);
 if(!a||!settings)return null;
 const ex=a.exercises[a.cursor],done=doneSets(a),total=totalSets(a),elapsed=now?Math.max(0,Math.floor((now-Date.parse(a.startedAt))/1000)):0,unit=settings.unit;
 const finishNow=async()=>{if(done===0){setMenu('finish');return;}if(done<total){setMenu('finish');return;}await g.finish();};
 return <div className={'gy-workout'+(flash?' flash':'')} role="dialog" aria-modal="true" aria-label={'Treino em andamento: '+a.name}>
  <header className="gy-wo-head"><button className="icon-button" onClick={()=>g.setOpen(false)} aria-label="Minimizar o treino" title="Minimizar"><ChevronDown size={21}/></button>
   <div><strong>{a.name}</strong><small>{fmtClock(elapsed)} · {done}/{total} séries</small></div>
   <button className="icon-button" onClick={()=>setMenu('options')} aria-label="Opções do treino"><MoreHorizontal size={20}/></button><button className="button primary small" onClick={finishNow}>Finalizar</button></header>
  <div className="gy-wo-progress" aria-hidden><span style={{width:(total?done/total*100:0)+'%'}}/><b>{fmtVolume(volumeOf(a),unit)}</b></div>
  {g.offline&&<p className="gy-offline" role="status">Sem conexão. Suas séries ficam guardadas aqui e vão quando a internet voltar.</p>}
  <div className="gy-wo-body">
   <nav className="gy-dots" aria-label="Exercícios deste treino">{a.exercises.map((e,i)=>{const all=e.sets.length>0&&e.sets.every(s=>s.done),some=e.sets.some(s=>s.done);return <button key={e.id} className={(i===a.cursor?'current ':'')+(all?'done':some?'started':'')+(e.superset?' linked':'')} onClick={()=>g.act({type:'cursor',index:i})} aria-label={'Exercício '+(i+1)+': '+(exerciseOf(e.exerciseId,g.view!.profile.custom)?.name||'')+(all?' (feito)':'')} aria-current={i===a.cursor?'step':undefined}>{all?<Check size={13}/>:i+1}</button>;})}</nav>
   {ex?<ExerciseCard key={ex.id} ex={ex} index={a.cursor}/>:<div className="panel gy-empty"><p>Treino sem exercícios ainda.</p><button className="button primary" onClick={()=>setMenu('add')}><Plus size={16}/>Adicionar exercício</button></div>}
   {ex&&<div className="gy-prevnext"><button className="button ghost" disabled={a.cursor===0} onClick={()=>g.act({type:'cursor',index:a.cursor-1})}><ChevronLeft size={17}/>Anterior</button><button className="button ghost" disabled={a.cursor>=a.exercises.length-1} onClick={()=>g.act({type:'cursor',index:a.cursor+1})}>Próximo<ChevronRight size={17}/></button></div>}
   <div className="panel gy-wo-extra"><button onClick={()=>setMenu('add')}><Plus size={17}/>Adicionar exercício</button><button onClick={()=>setMenu('note')}><NotebookPen size={17}/>{a.notes?'Nota da sessão: '+a.notes.slice(0,40):'Nota da sessão'}</button></div>
  </div>
  {rest&&<RestBar left={left} paused={rest.pausedLeft!==null} total={rest.total}/>}
  {menu==='options'&&<Modal title="Opções do treino" eyebrow="TREINO" onClose={()=>setMenu(null)}><div className="gy-menu">
   <button onClick={()=>setMenu('rename')}><Pencil size={17}/>Renomear treino</button><button onClick={()=>setMenu('add')}><Plus size={17}/>Adicionar exercício</button><button onClick={()=>setMenu('note')}><NotebookPen size={17}/>Nota da sessão</button>
   <label className="gy-menu-check"><input type="checkbox" checked={a.noProgression} onChange={e=>g.act({type:'flag',noProgression:e.target.checked})}/><span><strong>Não contar para a progressão</strong><small>Para deload, teste ou treino diferente. Fica no histórico.</small></span></label>
   <button className="danger" onClick={async()=>{if(window.confirm('Descartar este treino? As séries marcadas serão perdidas.'))await g.discard();}}><Trash2 size={17}/>Descartar treino</button></div></Modal>}
  {menu==='rename'&&<TextModal title="Nome do treino" value={a.name} max={60} onSave={v=>{g.act({type:'rename',name:v});setMenu(null);}} onClose={()=>setMenu(null)}/>}
  {menu==='note'&&<TextModal title="Nota da sessão" value={a.notes} max={600} multiline onSave={v=>{g.act({type:'note',text:v});setMenu(null);}} onClose={()=>setMenu(null)}/>}
  {menu==='add'&&<ExercisePicker title="Adicionar ao treino" multiple onClose={()=>setMenu(null)} onPick={e=>g.act({type:'addExercise',exercise:looseExercise(e.id,g.view!.profile,g.view!.workouts,uid),index:a.exercises.length})}/>}
  {menu==='finish'&&<Modal title={done===0?'Nada marcado ainda':'Finalizar o treino?'} subtitle={done===0?'Nenhuma série foi marcada como feita.':plural(total-done,'série ficou','séries ficaram')+' sem marcar. Elas não entram no histórico.'} eyebrow="FINALIZAR" onClose={()=>setMenu(null)}>
   <div className="modal-footer">{done===0?<><button className="button ghost" onClick={async()=>{await g.discard();setMenu(null);}}>Descartar treino</button><button className="button primary" onClick={()=>setMenu(null)}>Continuar treinando</button></>
    :<><button className="button ghost" onClick={()=>setMenu(null)}>Continuar treinando</button><button className="button primary" onClick={async()=>{setMenu(null);await g.finish();}}><Check size={16}/>Finalizar e salvar</button></>}</div></Modal>}
 </div>;}

function RestBar({left,paused,total}:{left:number;paused:boolean;total:number}){const g=useGym();const [edit,setEdit]=useState(false);
 return <div className={'gy-rest'+(left===0?' over':'')} role="status" aria-live="off">
  <div className="gy-rest-track" aria-hidden><span style={{width:(total?Math.min(100,left/total*100):0)+'%'}}/></div>
  <button className="gy-rest-time" onClick={()=>setEdit(true)} aria-label={'Descanso: '+fmtClock(left)+'. Mudar o tempo'}><Timer size={18}/><strong>{left===0?'Bora!':fmtClock(left)}</strong><small>{left===0?'Descanso feito':paused?'Pausado':'Descanso'}</small></button>
  <div className="gy-rest-actions"><button onClick={()=>g.act({type:'rest',action:'add',sec:-15})} aria-label="Menos 15 segundos">−15s</button><button onClick={()=>g.act({type:'rest',action:'add',sec:15})} aria-label="Mais 15 segundos">+15s</button>
   <button onClick={()=>g.act({type:'rest',action:paused?'resume':'pause'})} aria-label={paused?'Continuar o descanso':'Pausar o descanso'}>{paused?<Play size={17}/>:<Pause size={17}/>}</button><button onClick={()=>g.act({type:'rest',action:'skip'})} aria-label="Pular o descanso"><SkipForward size={17}/></button></div>
  {edit&&<Modal title="Tempo de descanso" eyebrow="DESCANSO" onClose={()=>setEdit(false)}><div className="gy-rest-grid">{[30,45,60,90,120,150,180,240,300,420,600,900].map(s=><button key={s} className="button outline" onClick={()=>{g.act({type:'rest',action:'set',sec:s});setEdit(false);}}>{fmtSecs(s)}</button>)}</div></Modal>}
 </div>;}

function ExerciseCard({ex,index}:{ex:ActiveExercise;index:number}){const g=useGym(),view=g.view!,settings=view.profile.settings,unit=settings.unit,e=exerciseOf(ex.exerciseId,view.profile.custom);
 const [menu,setMenu]=useState<'menu'|'swap'|'note'|'how'|'history'|null>(null),[effortFor,setEffortFor]=useState<string|null>(null),[setMenuFor,setSetMenuFor]=useState<string|null>(null),[showBest,setShowBest]=useState(false);
 const history=useMemo(()=>sessionsOf(view.workouts,ex.exerciseId),[view.workouts,ex.exerciseId]);const best=useMemo(()=>bestOf(history),[history]),heavy=useMemo(()=>heaviestOf(history),[history]);
 const last=history[0],timed=!!ex.target?.timeSec||(!!e?.timed&&ex.sets.every(s=>s.reps===null)),bw=bodyweight(e),inc=unit==='lb'?(bw?2.5:5):(defaultIncrement(e)||2.5);
 const a=view.active!,grp=groupOf(a,index),linked=grp.end>grp.start;
 const set=(s:GymSet,field:'weight'|'reps'|'timeSec'|'effort',value:number|null)=>g.act({type:'set',exId:ex.id,setId:s.id,field,value});
 const t=ex.target,plan=t?(timed?t.sets+' × '+fmtSecs(t.timeSec||30):t.sets+' × '+t.reps+(t.repMax&&t.repMax>t.reps?' (faixa até '+t.repMax+')':'')):'';
 const fmtSet=(s:GymSet)=>(s.weight?fmtNumber(toUnit(s.weight,unit),1)+'×':'')+(s.timeSec?fmtSecs(s.timeSec):s.reps??'–')+(s.effort!==null&&settings.effort!=='off'?' ('+effortLabel(s.effort,settings.effort)+')':'');
 return <article className="panel gy-ex">
  <header><div><span className="eyebrow">{linked?'SUPERSET · ':''}EXERCÍCIO {index+1}</span><h2>{e?.name||'Exercício removido'}</h2><MuscleChips exercise={e}/></div><button className="icon-button" onClick={()=>setMenu('menu')} aria-label="Ações do exercício"><MoreHorizontal size={20}/></button></header>
  <div className="gy-ex-lines">{plan&&<p><b>Meta</b> {plan}{ex.restSec?' · descanso '+fmtSecs(ex.restSec):''}</p>}
   {last&&<button className="gy-last" onClick={()=>setShowBest(v=>!v)}>{showBest&&best?<><b>Melhor</b> {best.weight?fmtWeight(best.weight,unit)+' × '+best.reps+(best.e1rm?' · 1RM estimado '+fmtWeight(best.e1rm,unit):''):best.timeSec?fmtSecs(best.timeSec):best.reps+' reps'} <small>{fmtDate(best.date)}</small></>:<><b>Última vez</b> {workSets(last.sets).map(fmtSet).join(', ')} <small>{fmtDate(last.date)}</small></>}</button>}
   {t?.why&&<p className={'gy-why'+(t.deload?' deload':'')}>{t.deload?<TrendingDown size={14}/>:<TrendingUp size={14}/>}{t.why}</p>}
   {ex.notes&&<p className="gy-note"><NotebookPen size={13}/>{ex.notes}</p>}</div>
  <div className={'gy-sets'+(timed?' timed':'')+(settings.effort==='off'?' no-effort':'')} role="table" aria-label="Séries">
   <div className="gy-set-head" role="row"><span role="columnheader">#</span><span role="columnheader">{bw?'Carga extra':'Peso'} ({unit})</span><span role="columnheader">{timed?'Tempo (s)':'Reps'}</span>{settings.effort!=='off'&&<span role="columnheader">{settings.effort==='rpe'?'RPE':'RIR'}</span>}<span role="columnheader"><span className="sr-only">Feito</span></span></div>
   {ex.sets.map((s,i)=>{const record=isRecord(s,best,heavy)&&history.length>0;const n=ex.sets.slice(0,i+1).filter(x=>x.kind==='work').length;
    return <div key={s.id} role="row" className={'gy-set'+(s.done?' done':'')+(s.kind!=='work'?' kind-'+s.kind:'')}>
     <button className="gy-set-n" onClick={()=>setSetMenuFor(s.id)} aria-label={'Série '+(i+1)+': '+SET_KIND_LABEL[s.kind]+'. Abrir opções'}>{s.kind==='warmup'?'A':s.kind==='drop'?'D':s.kind==='burst'?'R':n}</button>
     <Stepper label={'Peso da série '+(i+1)} value={s.weight} unit={unit} step={inc} max={unit==='lb'?2200:1000} onChange={v=>set(s,'weight',v)} compact/>
     {timed?<Stepper label={'Tempo da série '+(i+1)} value={s.timeSec} step={5} max={7200} decimals={0} onChange={v=>set(s,'timeSec',v)} compact/>:<Stepper label={'Reps da série '+(i+1)} value={s.reps} step={1} max={500} decimals={0} onChange={v=>set(s,'reps',v)} compact/>}
     {settings.effort!=='off'&&<button className={'gy-effort'+(s.effort!==null?' '+effortTone(s.effort):'')} onClick={()=>setEffortFor(s.id)} aria-label={'Esforço da série '+(i+1)+(s.effort!==null?': '+effortLabel(s.effort,settings.effort):'')}>{s.effort===null?(settings.effort==='rpe'?'RPE':'RIR'):fmtNumber(settings.effort==='rpe'?10-s.effort:s.effort)}</button>}
     <label className="gy-done"><input type="checkbox" checked={s.done} onChange={ev=>{unlockAudio();g.act({type:'done',exId:ex.id,setId:s.id,done:ev.target.checked});}} aria-label={'Série '+(i+1)+' feita'}/><i aria-hidden><Check size={16}/></i></label>
     {record&&s.done&&<span className="gy-pr" title="Recorde"><Trophy size={12}/>Recorde</span>}
    </div>;})}
   <button className="gy-add-set" onClick={()=>g.act({type:'addSet',exId:ex.id,setId:uid()})}><Plus size={15}/>Adicionar série</button></div>
  {settings.plates&&e?.equipment==='barbell'&&<PlateLine sets={ex.sets} bar={settings.bar} unit={unit}/>}
  {effortFor&&<EffortPicker scale={settings.effort} value={ex.sets.find(s=>s.id===effortFor)?.effort??null} onPick={v=>{const s=ex.sets.find(x=>x.id===effortFor);if(s)set(s,'effort',v);setEffortFor(null);}} onClose={()=>setEffortFor(null)}/>}
  {setMenuFor&&<Modal title="Tipo da série" eyebrow="SÉRIE" onClose={()=>setSetMenuFor(null)}><div className="gy-menu">{SET_KINDS.map(k=><button key={k} className={ex.sets.find(s=>s.id===setMenuFor)?.kind===k?'active':''} onClick={()=>{g.act({type:'setKind',exId:ex.id,setId:setMenuFor,kind:k as SetKind});setSetMenuFor(null);}}>{SET_KIND_LABEL[k]}</button>)}
   <button onClick={()=>{const s=ex.sets.find(x=>x.id===setMenuFor);g.act({type:'addSet',exId:ex.id,setId:uid(),kind:s?.kind});setSetMenuFor(null);}}><Plus size={16}/>Copiar esta série</button>
   <button className="danger" onClick={()=>{g.act({type:'removeSet',exId:ex.id,setId:setMenuFor});setSetMenuFor(null);}}><Trash2 size={16}/>Remover série</button></div></Modal>}
  {menu==='menu'&&<Modal title={e?.name||'Exercício'} eyebrow="EXERCÍCIO" onClose={()=>setMenu(null)}><div className="gy-menu">
   {ex.backupId&&<button onClick={()=>{const n=ex.backupId!,prev=sessionsOf(view.workouts,n)[0];g.act({type:'swap',exId:ex.id,exerciseId:n,weight:prev?Math.max(0,...workSets(prev.sets).map(s=>s.weight||0))||null:null});setMenu(null);}}><Repeat size={17}/>Usar a reserva: {exerciseOf(ex.backupId,view.profile.custom)?.name}</button>}
   <button onClick={()=>setMenu('swap')}><Repeat size={17}/>Trocar exercício</button><button onClick={()=>setMenu('note')}><NotebookPen size={17}/>{ex.notes?'Editar nota':'Adicionar nota'}</button>
   {!!e?.steps.length&&<button onClick={()=>setMenu('how')}><BookOpen size={17}/>Como fazer</button>}<button onClick={()=>setMenu('history')}><History size={17}/>Histórico deste exercício</button>
   <button onClick={()=>{g.act({type:'rest',action:'set',sec:ex.restSec||settings.restSec});setMenu(null);}}><Timer size={17}/>Iniciar descanso agora</button>
   <button disabled={index===0} onClick={()=>{g.act({type:'moveExercise',exId:ex.id,dir:-1});setMenu(null);}}><ArrowUp size={17}/>Mover para cima</button><button disabled={index>=a.exercises.length-1} onClick={()=>{g.act({type:'moveExercise',exId:ex.id,dir:1});setMenu(null);}}><ArrowDown size={17}/>Mover para baixo</button>
   <button className="danger" onClick={()=>{g.act({type:'removeExercise',exId:ex.id});setMenu(null);}}><Trash2 size={17}/>Tirar do treino</button></div></Modal>}
  {menu==='swap'&&<ExercisePicker title="Trocar por" subtitle="Séries e reps continuam; a carga vem da última vez que você fez o novo exercício." onClose={()=>setMenu(null)} onPick={n=>{const prev=sessionsOf(view.workouts,n.id)[0];g.act({type:'swap',exId:ex.id,exerciseId:n.id,weight:prev?Math.max(0,...workSets(prev.sets).map(s=>s.weight||0))||null:null});setMenu(null);}}/>}
  {menu==='note'&&<TextModal title="Nota do exercício" value={ex.notes} max={300} multiline onSave={v=>{g.act({type:'note',exId:ex.id,text:v});setMenu(null);}} onClose={()=>setMenu(null)}/>}
  {menu==='how'&&e&&<HowTo exercise={e} onClose={()=>setMenu(null)}/>}
  {menu==='history'&&<Modal title="Histórico" subtitle={e?.name} eyebrow="EXERCÍCIO" onClose={()=>setMenu(null)}>{history.length?<ul className="gy-history-mini">{history.slice(0,10).map(h=><li key={h.workoutId}><time>{fmtDate(h.date)}</time><span>{workSets(h.sets).map(fmtSet).join(' · ')}</span><small>{Math.max(...workSets(h.sets).map(s=>e1rm(s.weight,s.reps)))>0?'1RM '+fmtWeight(Math.max(...workSets(h.sets).map(s=>e1rm(s.weight,s.reps))),unit):''}</small></li>)}</ul>:<p className="quiet-copy">Primeira vez com este exercício.</p>}</Modal>}
 </article>;}

// Anilhas da próxima série com carga: o que vai de cada lado e, se não fecha, o total que dá para montar.
function PlateLine({sets,bar,unit}:{sets:GymSet[];bar:number;unit:'kg'|'lb'}){const s=sets.find(x=>!x.done&&x.weight)||[...sets].reverse().find(x=>x.weight);if(!s?.weight)return null;const r=platesFor(s.weight,bar,unit==='lb'?LB_PLATES:KG_PLATES);if(!r)return null;
 return <p className="gy-plates"><b>Anilhas por lado</b> {r.perSide.length?r.perSide.map(p=>fmtNumber(toUnit(p,unit),2)).join(' + '):'só a barra'} <small>· barra {fmtWeight(bar,unit)}{r.exact?'':' · dá '+fmtWeight(r.achieved,unit)}</small></p>;}
export function HowTo({exercise,onClose}:{exercise:Exercise;onClose:()=>void}){const app=useApp();return <Modal title={exercise.name} subtitle={EQUIPMENT[exercise.equipment]||''} eyebrow="COMO FAZER" onClose={onClose}><div className="gy-ex-top"><BodyMap level={levelOfExercises([{exercise}])} gender={app.state.profile.gender} size="sm" label="Músculos do exercício"/><MuscleChips exercise={exercise} limit={6}/></div><ol className="gy-steps">{exercise.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>{exercise.tip&&<p className="gy-tip"><Sparkles size={14}/>{exercise.tip}</p>}<p className="quiet-copy">Descreve o movimento, não substitui a orientação de um profissional. Se doer, pare.</p></Modal>;}
function EffortPicker({scale,value,onPick,onClose}:{scale:Effort;value:number|null;onPick:(v:number|null)=>void;onClose:()=>void}){
 return <Modal title="Quanto sobrou no tanque?" subtitle={scale==='rpe'?'RPE: 10 é o máximo; cada ponto abaixo é uma rep que ainda sairia.':'RIR: quantas reps ainda sairiam com boa técnica.'} eyebrow="ESFORÇO" onClose={onClose}>
  <div className="gy-effort-list">{RIR_LEVELS.map(([rir,text])=><button key={rir} className={effortTone(rir)+(value===rir?' active':'')} onClick={()=>onPick(rir)}><b>{scale==='rpe'?(rir>=5?'≤5':fmtNumber(10-rir)):rir===5?'5+':rir}</b><span>{text}</span></button>)}</div>
  {value!==null&&<button className="button ghost full-width" onClick={()=>onPick(null)}><X size={15}/>Limpar</button>}</Modal>;}
export function TextModal({title,value,max,multiline=false,onSave,onClose}:{title:string;value:string;max:number;multiline?:boolean;onSave:(v:string)=>void;onClose:()=>void}){const [v,setV]=useState(value);
 return <Modal title={title} eyebrow="GYM" onClose={onClose}><form onSubmit={ev=>{ev.preventDefault();onSave(v.trim());}}><label className="field"><span>{title}</span>{multiline?<textarea autoFocus rows={4} maxLength={max} value={v} onChange={ev=>setV(ev.target.value)}/>:<input autoFocus maxLength={max} value={v} onChange={ev=>setV(ev.target.value)}/>}</label><div className="modal-footer"><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button className="button primary">Salvar</button></div></form></Modal>;}

// Resumo depois de finalizar (e no detalhe do histórico): duração, volume, séries, recordes e músculos.
export function WorkoutSummary({workout,onClose,fresh=false}:{workout:Workout;onClose:()=>void;fresh?:boolean}){const g=useGym(),app=useApp(),view=g.view!,unit=view.profile.settings.unit;
 const records=useMemo(()=>recordsIn(workout,view.workouts),[workout,view.workouts]),list=workout.exercises.map(e=>exerciseOf(e.exerciseId,view.profile.custom));
 const sets=workout.exercises.reduce((n,e)=>n+workSets(e.sets).length,0);
 return <Modal title={fresh?'Treino feito!':workout.name} subtitle={fresh?workout.name+' · '+fmtDate(workout.date):fmtDate(workout.date,{weekday:'long',day:'numeric',month:'long'})} eyebrow={fresh?'MANDOU BEM':'TREINO'} onClose={onClose}>
  <div className="gy-summary"><div><small>Duração</small><strong>{fmtMinutes(workout.durationMin)}</strong></div><div><small>Volume</small><strong>{fmtVolume(volumeOf(workout),unit)}</strong></div><div><small>Séries</small><strong>{sets}</strong></div><div><small>Recordes</small><strong>{records.length||'–'}</strong></div></div>
  {records.length>0&&<p className="gy-records"><Trophy size={15}/>Recorde em {records.map(id=>exerciseOf(id,view.profile.custom)?.name).join(', ')}.</p>}
  <h4 className="gy-sub">O que você treinou</h4><BodyMap level={levelOfExercises(workout.exercises.map(e=>({exercise:exerciseOf(e.exerciseId,view.profile.custom),sets:workSets(e.sets).length})))} gender={app.state.profile.gender} size="sm" label="Músculos trabalhados neste treino"/><p className="gy-chips">{musclesWorked(list).slice(0,8).map(m=><span key={m} className="gy-chip main">{m}</span>)}</p>
  {fresh&&<p className="quiet-copy">Também entrou nos seus treinos do GeoAI, com os pontos da sua jornada.</p>}
  <div className="modal-footer"><button className="button primary" onClick={onClose}><Check size={16}/>{fresh?'Boa!':'Fechar'}</button></div></Modal>;}

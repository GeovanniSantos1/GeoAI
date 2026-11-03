'use client';
import {useState} from 'react';
import {Play,LoaderCircle,RefreshCw,House,CalendarRange,History,Dumbbell,Ruler,Settings2,Plus} from 'lucide-react';
import {doneSets,totalSets,type Workout} from '@/lib/gym-active';
import {PageHeading,Tabs,MiniChart} from './primitives';
import {Records} from './records';
import {useApp} from './context';
import {GymProvider,useGym} from './gym-context';
import {TodayTab,StartSheet,WeighIn} from './gym-today';
import {PlanTab} from './gym-routines';
import {HistoryTab,WorkoutDetail} from './gym-history';
import {LibraryTab,GymSettingsTab} from './gym-library';
import {GymWorkout,WorkoutSummary} from './gym-workout';
// Modo Gym (menu Treinos): plano, treino guiado, histórico, exercícios e corpo. Carregado sob demanda, com o catálogo.
const TABS=[{id:'hoje',label:'Hoje',icon:House},{id:'plano',label:'Plano',icon:CalendarRange},{id:'historico',label:'Histórico',icon:History},{id:'exercicios',label:'Exercícios',icon:Dumbbell},{id:'corpo',label:'Corpo',icon:Ruler},{id:'ajustes',label:'Ajustes',icon:Settings2}];
export default function GymView(){return <GymProvider><GymShell/></GymProvider>;}
function GymShell(){const g=useGym();const [tab,setTab]=useState('hoje'),[detail,setDetail]=useState<Workout|null>(null),[sheet,setSheet]=useState(false);
 if(!g.view)return g.error?<section className="panel gy-loading"><p role="alert">{g.error}</p><button className="button primary" onClick={g.reload}><RefreshCw size={16}/>Tentar de novo</button></section>:<section className="gy-loading" aria-busy="true"><LoaderCircle className="spin"/><p>Abrindo o Gym…</p></section>;
 const a=g.view.active;
 return <>
  <PageHeading eyebrow="MODO GYM" title="Seu treino" description="Planeje a semana, treine com o descanso marcado e veja a carga subir." action={a?undefined:'Começar treino'} onAction={a?undefined:()=>setSheet(true)}/>
  {a&&!g.open&&<ActiveBanner/>}
  <Tabs items={TABS} value={tab} onChange={setTab}/>
  {tab==='hoje'&&<TodayTab onPlan={()=>setTab('plano')} onWorkout={setDetail}/>}
  {tab==='plano'&&<PlanTab/>}
  {tab==='historico'&&<HistoryTab onOpen={setDetail}/>}
  {tab==='exercicios'&&<LibraryTab/>}
  {tab==='corpo'&&<BodyTab/>}
  {tab==='ajustes'&&<GymSettingsTab/>}
  {a&&g.open&&<GymWorkout/>}
  {detail&&<WorkoutDetail key={detail.id} workout={detail} onClose={()=>setDetail(null)}/>}
  {g.summary&&<WorkoutSummary workout={g.summary} fresh onClose={()=>g.setSummary(null)}/>}
  {sheet&&<StartSheet onClose={()=>setSheet(false)}/>}
 </>;}
// Treino aberto e minimizado: uma faixa para voltar, com o tempo e as séries.
function ActiveBanner(){const g=useGym(),a=g.view!.active!;
 return <button className="gy-banner" onClick={()=>g.setOpen(true)}><span className="gy-banner-dot" aria-hidden/><span><strong>Treino em andamento · {a.name}</strong><small>{doneSets(a)}/{totalSets(a)} séries · começou às {new Date(a.startedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></span><span className="button primary small"><Play size={15}/>Voltar ao treino</span></button>;}
// Corpo: peso e medidas do GeoAI (a mesma coleção de antes), com a pesagem rápida do Gym.
function BodyTab(){const a=useApp();const [weigh,setWeigh]=useState(false);const measures=a.state.measurements.filter(m=>m.weight).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date)));
 return <><div className="section-action"><p className="quiet-copy">O acompanhamento do seu corpo, sem comparação.</p><div className="button-group"><button className="button outline" onClick={()=>setWeigh(true)}>Pesagem rápida</button><button className="button primary" onClick={()=>a.edit('measurements',undefined,{title:'Minhas medidas'})}><Plus size={16}/>Registrar medidas</button></div></div>
  {measures.length>1&&<section className="panel"><header className="section-heading"><h2>Peso ao longo do tempo</h2></header><MiniChart values={measures.slice(-12).map(x=>x.weight||0)} labels={measures.slice(-12).map(x=>String(x.date).slice(8)+'/'+String(x.date).slice(5,7))}/></section>}
  <Records collection="measurements" renderExtra={m=><div className="measurement-values">{[['weight','kg','Peso'],['waist','cm','Cintura'],['chest','cm','Peito'],['arm','cm','Braço']].filter(([k])=>m[k]).map(([k,u,l])=><span key={k}><small>{l}</small><b>{m[k]} <i>{u}</i></b></span>)}</div>}/>
  {weigh&&<WeighIn onClose={()=>setWeigh(false)}/>}</>;}

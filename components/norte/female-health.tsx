'use client';
import {useState} from 'react';import {Plus,Droplet,CalendarDays,ShieldCheck,Pill,Syringe,FlaskConical,Stethoscope,Pencil,Trash2,Check,Sparkles,Utensils,Moon,Dumbbell,Heart,HeartPulse,Leaf} from 'lucide-react';
import {useApp,type AppContext} from './context';import {PageHeading,Tabs,Stat,Empty} from './primitives';import {Records} from './records';import {ExamsPanel,OVERALL_PILL} from './exams';import {FEMALE_TIPS} from './female-health-tips';import {CycleCalendar} from './cycle-calendar';
import {cyclePrediction,dailyStatus,injectionNext,iudStatus,sortPreventives,takeId,dayDiff,FLOW_LABEL,METHOD_SHORT,PREVENTIVE_LABEL,PREVENTIVE_SUGGESTIONS,type PreventiveState} from '@/lib/female-health';import {finalOverall,OVERALL_LABEL} from '@/lib/testosterone';import type {Item} from '@/lib/types';
const ICONS={utensils:Utensils,heart:Heart,moon:Moon,dumbbell:Dumbbell,droplet:Droplet,stethoscope:Stethoscope};
const PREVENTIVE_PILL:Record<PreventiveState,string>={none:'pill',late:'pill danger',soon:'pill warn',ok:'pill green'};
const dayLabel=(d:string)=>d?d.split('-').reverse().join('/'):'';
const shortDay=(d:string)=>dayLabel(d).slice(0,5);
const plural=(n:number)=>n+(n===1?' dia':' dias');
const takenToday=(a:AppContext,m:Item)=>a.state.contraceptiveDoses.some(d=>d.methodId===m.id&&d.date===a.today);
const newPeriod=(a:AppContext)=>a.edit('periods',undefined,{date:a.today,title:'Menstruação',flow:'moderado'});
// Um registro de sintomas por dia: se o de hoje existe, abre para editar.
const newSymptoms=(a:AppContext)=>{const today=a.state.symptoms.find(x=>x.date===a.today);if(today)a.edit('symptoms',today);else a.edit('symptoms',undefined,{date:a.today,title:'Sintomas do dia',symptoms:[]});};
const newMethod=(a:AppContext)=>a.edit('contraceptives',undefined,{method:'daily',status:'active',remind:true,activeDays:21,pauseDays:7,intervalDays:30,time:'21:00'});
// Id fixo por método e dia: tocar de novo, ou registrar pelo app e pelo Telegram, não duplica.
const take=(a:AppContext,m:Item)=>a.mutate({type:'upsert',collection:'contraceptiveDoses',item:{id:takeId(m.id,a.today),title:(m.method==='injection'?'Injeção: ':'Tomei: ')+m.title,date:a.today,methodId:m.id}});

export function FemaleHealthView(){const a=useApp();const [tab,setTab]=useState('resumo');
 return <><PageHeading eyebrow="CUIDAR DE SI" title="Saúde feminina" description="Ciclo, anticoncepcional, exames e preventivos em um só lugar."/>
  <p className="health-disclaimer"><ShieldCheck size={16}/>As previsões são estimativas e não substituem seu médico nem servem como método contraceptivo.</p>
  <Tabs value={tab} onChange={setTab} items={[{id:'resumo',label:'Resumo'},{id:'ciclo',label:'Ciclo'},{id:'metodo',label:'Anticoncepcional'},{id:'exames',label:'Exames',count:a.state.labExams.length},{id:'preventivos',label:'Preventivos'},{id:'dicas',label:'Dicas'}]}/>
  {tab==='resumo'&&<Summary onTab={setTab}/>}{tab==='ciclo'&&<CyclePanel/>}{tab==='metodo'&&<MethodsPanel/>}{tab==='exames'&&<ExamsPanel/>}{tab==='preventivos'&&<PreventivesPanel/>}{tab==='dicas'&&<TipsPanel/>}</>;}

function MethodToday({m}:{m:Item}){const a=useApp();
 if(m.method==='daily'){const st=dailyStatus(m,a.today),done=takenToday(a,m);return <Stat label={'Hoje · '+m.title} icon={Pill} value={!st.active?'Pausa':done?'Tomado':'Pendente'} foot={!st.active?(st.pauseUntil?'Pausa até '+dayLabel(st.pauseUntil):'Começa em '+dayLabel(m.startDate)):'Dia '+st.packDay+' da cartela'} accent={st.active&&!done}/>;}
 if(m.method==='injection'){const next=injectionNext(m,a.state.contraceptiveDoses),days=dayDiff(a.today,next);return <Stat label={'Próxima injeção · '+m.title} icon={Syringe} value={dayLabel(next)} foot={days<0?'Atrasada há '+plural(-days):days===0?'É hoje':'Faltam '+plural(days)} accent={days<=0}/>;}
 const st=iudStatus(m,a.today);return <Stat label={'Troca · '+m.title} icon={CalendarDays} value={dayLabel(m.changeDate)} foot={st.daysLeft<0?'Troca atrasada':st.soon?'Faltam '+plural(st.daysLeft):'Em dia'} accent={st.soon}/>;}

function Summary({onTab}:{onTab:(t:string)=>void}){const a=useApp();const c=cyclePrediction(a.state.periods,a.today);const active=a.state.contraceptives.filter(m=>m.status==='active');
 const next=sortPreventives(a.state.preventives,a.today)[0];
 const reviewed=a.state.labExams.filter(e=>e.status==='reviewed').sort((x,y)=>x.date.localeCompare(y.date));const last=reviewed[reviewed.length-1];const overall=last?finalOverall(last,a.state.labExams,'female'):null;const points=(last?.review?.points||[]) as {marker:string;text:string}[];
 const pending=active.filter(m=>m.method!=='iud'&&!takenToday(a,m)&&(m.method==='injection'?dayDiff(a.today,injectionNext(m,a.state.contraceptiveDoses))<=3:dailyStatus(m,a.today).active));
 return <>
  <div className="stats-grid three female-stats">
   <Stat label="Ciclo" icon={Droplet} value={c?'Dia '+c.cycleDay:'—'} foot={c?(c.late?'Menstruação atrasada há '+plural(c.late):c.daysToNext===0?'Menstruação prevista para hoje':'Próxima em '+plural(c.daysToNext)+' · '+dayLabel(c.next)):'Registre sua última menstruação'} accent={!!c?.late}/>
   <Stat label="Janela fértil estimada" icon={Leaf} value={c?shortDay(c.fertileStart)+' a '+shortDay(c.fertileEnd):'—'} foot={c?'Ovulação por volta de '+dayLabel(c.ovulation):'Aparece depois do primeiro registro'}/>
   {active.map(m=><MethodToday key={m.id} m={m}/>)}
   {next&&<Stat label={'Preventivo · '+next.p.title} icon={Stethoscope} value={next.st.next?dayLabel(next.st.next):'Sem registro'} foot={PREVENTIVE_LABEL[next.st.state]} accent={next.st.state==='late'}/>}
   <Stat label="Último exame" icon={FlaskConical} value={last?dayLabel(last.date):'—'} foot={overall?OVERALL_LABEL[overall]:'Envie seu primeiro exame'}/>
  </div>
  <div className="button-group spaced"><button className="button primary" onClick={()=>newPeriod(a)}><Droplet size={16}/>Menstruação começou</button>{pending.map(m=><button key={m.id} className="button outline" disabled={a.busy} onClick={()=>take(a,m)}>{m.method==='injection'?<Syringe size={16}/>:<Check size={16}/>}{m.method==='injection'?'Registrar injeção':'Tomei'}{pending.length>1?' · '+m.title:''}</button>)}<button className="button outline" onClick={()=>newSymptoms(a)}><HeartPulse size={16}/>Registrar sintomas</button>{!a.state.contraceptives.length&&<button className="button outline" onClick={()=>onTab('metodo')}><Plus size={16}/>Cadastrar método</button>}</div>
  {overall&&points.length>0&&<section className="panel"><header className="section-heading"><h2>Pontos de atenção do último exame</h2><span className={OVERALL_PILL[overall]}>{OVERALL_LABEL[overall]}</span></header><ul className="review-list">{points.map((p,i)=><li key={i}><b>{p.marker}:</b> {p.text}</li>)}</ul></section>}
 </>;}

function CyclePanel(){const a=useApp();const c=cyclePrediction(a.state.periods,a.today);const periods=a.state.periods.slice().sort((x,y)=>x.date.localeCompare(y.date));const symptoms=a.state.symptoms.slice().sort((x,y)=>x.date.localeCompare(y.date));
 return <>
  <div className="button-group spaced"><button className="button primary" onClick={()=>newPeriod(a)}><Droplet size={16}/>Menstruação começou</button><button className="button outline" onClick={()=>newSymptoms(a)}><HeartPulse size={16}/>Registrar sintomas</button></div>
  {c&&<div className="stats-grid three female-stats"><Stat label="Duração média do ciclo" value={c.cycleLength+' dias'} foot={c.cycles?'Com base em '+c.cycles+(c.cycles===1?' ciclo':' ciclos'):'Padrão de 28 dias até registrar mais ciclos'}/><Stat label="Duração média da menstruação" value={c.periodLength+' dias'} foot="Registre o fim para melhorar a média"/><Stat label="Próxima menstruação" value={dayLabel(c.next)} foot={c.late?'Atrasada há '+plural(c.late):'Em '+plural(c.daysToNext)} accent={c.late>0}/></div>}
  <CycleCalendar/>
  <div className="section-action"><h2>Menstruações</h2></div>
  <Records collection="periods" items={periods} compact renderExtra={p=><p className="record-content">{[p.endDate?'Até '+dayLabel(p.endDate):'Sem data de fim',FLOW_LABEL[p.flow]||''].filter(Boolean).join(' · ')}</p>} emptyTitle="Nenhuma menstruação registrada" emptyText="Cada registro melhora a previsão do ciclo."/>
  <div className="section-action"><h2>Sintomas</h2></div>
  <Records collection="symptoms" items={symptoms} compact renderExtra={s=>s.symptoms?.length?<p className="record-content">{s.symptoms.join(', ')}</p>:null} emptyTitle="Nenhum sintoma registrado" emptyText="Anote como você se sente para perceber padrões ao longo do ciclo."/>
 </>;}

function methodLine(m:Item,doses:Item[],today:string){
 if(m.status==='paused')return METHOD_SHORT[m.method]+' · pausado';
 if(m.method==='daily'){const st=dailyStatus(m,today);return METHOD_SHORT.daily+' · '+m.activeDays+' dias de uso'+(m.pauseDays?' e '+m.pauseDays+' de pausa':', contínuo')+' · '+(st.active?'dia '+st.packDay+' da cartela':st.pauseUntil?'pausa até '+dayLabel(st.pauseUntil):'começa em '+dayLabel(m.startDate));}
 if(m.method==='injection')return METHOD_SHORT.injection+' a cada '+m.intervalDays+' dias · próxima: '+dayLabel(injectionNext(m,doses));
 return METHOD_SHORT.iud+' · colocado em '+dayLabel(m.startDate)+' · troca em '+dayLabel(m.changeDate)+(iudStatus(m,today).daysLeft<0?' (atrasada)':'');}

function MethodsPanel(){const a=useApp();const doses=a.state.contraceptiveDoses.slice().sort((x,y)=>x.date.localeCompare(y.date));
 return <>
  <div className="section-action"><p>Registre o método indicado pelo seu médico. O GeoAI acompanha as datas e lembra você no Telegram.</p><button className="button primary" onClick={()=>newMethod(a)}><Plus size={16}/>Novo método</button></div>
  {a.state.contraceptives.length?<div className="cards-grid">{a.state.contraceptives.map(m=><article className="panel record-card" key={m.id}>
   <div className="record-head"><span className={m.status==='active'?'pill green':'pill'}>{m.status==='active'?'Ativo':'Pausado'}</span>{m.remind&&m.method!=='iud'&&<span className="pill">Lembrete às {m.time}</span>}<div className="record-actions"><button className="icon-button" aria-label={'Editar '+m.title} onClick={()=>a.edit('contraceptives',m)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={'Excluir '+m.title} onClick={()=>a.remove('contraceptives',m)}><Trash2 size={15}/></button></div></div>
   <button className="record-title" onClick={()=>a.edit('contraceptives',m)}>{m.title}</button>
   <p className="record-content">{methodLine(m,a.state.contraceptiveDoses,a.today)}</p>
   {m.status==='active'&&m.method!=='iud'&&!takenToday(a,m)&&(m.method==='injection'||dailyStatus(m,a.today).active)&&<button className="button outline small" disabled={a.busy} onClick={()=>take(a,m)}><Check size={15}/>{m.method==='injection'?'Registrar injeção hoje':'Tomei hoje'}</button>}
  </article>)}</div>
  :<section className="panel"><Empty icon={Pill} title="Nenhum método registrado" description="Cadastre pílula, injeção ou DIU para acompanhar as datas e receber lembretes." action="Novo método" onAction={()=>newMethod(a)}/></section>}
  <div className="section-action"><h2>Registros</h2></div>
  <Records collection="contraceptiveDoses" items={doses} compact emptyTitle="Nenhum registro ainda" emptyText="Toque em Tomei ou responda o lembrete do Telegram."/>
 </>;}

function PreventivesPanel(){const a=useApp();const list=sortPreventives(a.state.preventives,a.today);
 const missing=PREVENTIVE_SUGGESTIONS.filter(([t])=>!a.state.preventives.some(p=>p.title.toLocaleLowerCase('pt-BR')===t.toLocaleLowerCase('pt-BR')));const add=()=>a.edit('preventives',undefined,{intervalMonths:12});
 return <>
  <div className="section-action"><p>Consultas e exames de rotina. O GeoAI calcula a próxima data a partir da última vez.</p><button className="button primary" onClick={add}><Plus size={16}/>Novo preventivo</button></div>
  {missing.length>0&&<div className="suggestion-chips">{missing.map(([title,months])=><button key={title} className="button outline small" disabled={a.busy} onClick={()=>a.mutate({type:'upsert',collection:'preventives',item:{title,intervalMonths:months}})}><Plus size={14}/>{title}</button>)}</div>}
  {list.length?<div className="cards-grid">{list.map(({p,st})=><article className="panel record-card" key={p.id}>
   <div className="record-head"><span className={PREVENTIVE_PILL[st.state]}>{PREVENTIVE_LABEL[st.state]}</span><div className="record-actions"><button className="icon-button" aria-label={'Editar '+p.title} onClick={()=>a.edit('preventives',p)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={'Excluir '+p.title} onClick={()=>a.remove('preventives',p)}><Trash2 size={15}/></button></div></div>
   <button className="record-title" onClick={()=>a.edit('preventives',p)}>{p.title}</button>
   <p className="record-content">A cada {p.intervalMonths} {p.intervalMonths===1?'mês':'meses'}{p.lastDate?' · última: '+dayLabel(p.lastDate):''}{st.next?' · próxima: '+dayLabel(st.next):''}</p>
   <button className="button outline small" disabled={a.busy||p.lastDate===a.today} onClick={()=>a.mutate({type:'upsert',collection:'preventives',item:{...p,lastDate:a.today}})}><Check size={15}/>Fiz hoje</button>
  </article>)}</div>
  :<section className="panel"><Empty icon={Stethoscope} title="Nenhum preventivo ainda" description="Use as sugestões acima ou cadastre suas consultas de rotina." action="Novo preventivo" onAction={add}/></section>}
 </>;}

function TipsPanel(){const a=useApp();const last=a.state.labExams.filter(e=>e.status==='reviewed'&&e.review?.tips?.length).sort((x,y)=>y.date.localeCompare(x.date))[0];
 return <>
  {last&&<section className="panel"><header className="section-heading"><h2><Sparkles size={18}/> Para você</h2><span className="pill">Exame de {dayLabel(last.date)}</span></header><ul className="review-list">{(last.review.tips as string[]).map((t,i)=><li key={i}>{t}</li>)}</ul></section>}
  <div className="tips-grid">{FEMALE_TIPS.map(t=>{const Icon=ICONS[t.icon];return <section className="panel" key={t.title}><header className="section-heading"><h2><Icon size={18}/> {t.title}</h2></header><ul>{t.items.map(x=><li key={x}>{x}</li>)}</ul></section>;})}</div>
 </>;}

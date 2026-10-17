'use client';
import {useState} from 'react';import {Plus,Syringe,FlaskConical,CalendarDays,ShieldCheck,Utensils,Sun,Moon,Dumbbell,Heart,Sparkles,Pencil,Trash2} from 'lucide-react';
import {useApp,type AppContext} from './context';import {PageHeading,Tabs,Stat,Empty,MiniChart} from './primitives';import {Records} from './records';import {ExamsPanel,OVERALL_PILL} from './exams';import {TIPS} from './testosterone-tips';
import {doseId,finalOverall,protocolStatus,punctuality,valueText,rangeText,OVERALL_LABEL} from '@/lib/testosterone';import type {Marker} from '@/lib/exam-schema';import type {Item} from '@/lib/types';
const ICONS={utensils:Utensils,sun:Sun,moon:Moon,dumbbell:Dumbbell,heart:Heart};
const dayLabel=(d:string)=>d.split('-').reverse().join('/');
const totalOf=(e:Item)=>(e.markers as Marker[]|undefined)?.find(m=>m.key==='testosterona_total');
const plural=(n:number)=>n+(n===1?' dia':' dias');
const newProtocol=(a:AppContext)=>a.edit('trtProtocols',undefined,{status:'active',remind:true,unit:'mg',intervalDays:14});
// Uma aplicação por protocolo por dia: se a de hoje já existe, abre para editar em vez de duplicar.
const registerDose=(a:AppContext,p:Item)=>{const existing=a.state.trtDoses.find(d=>d.protocolId===p.id&&d.date===a.today);if(existing)a.edit('trtDoses',existing);else a.edit('trtDoses',undefined,{id:doseId(p.id,a.today),title:'Aplicação: '+p.title,protocolId:p.id,dose:p.dose,date:a.today});};

export function TestosteroneView(){const a=useApp();const [tab,setTab]=useState('resumo');
 return <><PageHeading eyebrow="SAÚDE HORMONAL" title="Testosterona" description="Exames, protocolo e hábitos em um só lugar."/>
  <p className="health-disclaimer"><ShieldCheck size={16}/>A IA ajuda a entender seus exames, mas não substitui seu médico.</p>
  <Tabs value={tab} onChange={setTab} items={[{id:'resumo',label:'Resumo'},{id:'exames',label:'Exames',count:a.state.labExams.length},{id:'protocolo',label:'Protocolo'},{id:'dicas',label:'Dicas'}]}/>
  {tab==='resumo'&&<Summary onTab={setTab}/>}{tab==='exames'&&<ExamsPanel/>}{tab==='protocolo'&&<ProtocolPanel/>}{tab==='dicas'&&<TipsPanel/>}</>;}

function Summary({onTab}:{onTab:(t:string)=>void}){const a=useApp();const reviewed=a.state.labExams.filter(e=>e.status==='reviewed').sort((x,y)=>x.date.localeCompare(y.date));const last=reviewed[reviewed.length-1];const overall=last?finalOverall(last,a.state.labExams):null;const total=last?totalOf(last):undefined;const active=a.state.trtProtocols.filter(p=>p.status==='active');const chart=reviewed.filter(e=>totalOf(e)).slice(-8);const points=(last?.review?.points||[]) as {marker:string;text:string}[];
 return <>
  <div className="stats-grid three">
   <Stat label="Último exame" icon={FlaskConical} value={last?dayLabel(last.date):'—'} foot={overall?OVERALL_LABEL[overall]:'Envie seu primeiro exame'}/>
   <Stat label="Testosterona total" value={total?valueText(total):'—'} foot={total?'Faixa: '+rangeText(total):'Sem resultado ainda'}/>
   {active.map(p=>{const st=protocolStatus(p,a.state.trtDoses,a.today);return <Stat key={p.id} accent={st.overdue>0} label={'Próxima aplicação · '+p.title} icon={Syringe} value={dayLabel(st.next)} foot={st.overdue?'Atrasada há '+plural(st.overdue):st.daysLeft===0?'É hoje':'Faltam '+plural(st.daysLeft)}/>;})}
  </div>
  <div className="button-group">{active.map(p=><button key={p.id} className="button primary" onClick={()=>registerDose(a,p)}><Syringe size={16}/>Registrar aplicação{active.length>1?' · '+p.title:''}</button>)}{!a.state.trtProtocols.length&&<button className="button outline" onClick={()=>onTab('protocolo')}><Plus size={16}/>Cadastrar protocolo</button>}<button className="button outline" onClick={()=>onTab('exames')}><FlaskConical size={16}/>Enviar exame</button></div>
  {overall&&points.length>0&&<section className="panel"><header className="section-heading"><h2>Pontos de atenção</h2><span className={OVERALL_PILL[overall]}>{OVERALL_LABEL[overall]}</span></header><ul className="review-list">{points.map((p,i)=><li key={i}><b>{p.marker}:</b> {p.text}</li>)}</ul></section>}
  {chart.length>1&&<section className="panel"><header className="section-heading"><h2>Testosterona total por exame</h2></header><MiniChart values={chart.map(e=>totalOf(e)?.value||0)} labels={chart.map(e=>dayLabel(e.date).slice(0,5))}/></section>}
 </>;}

function ProtocolPanel(){const a=useApp();const doses=a.state.trtDoses.slice().sort((x,y)=>x.date.localeCompare(y.date));
 return <>
  <div className="section-action"><p>Registre o protocolo prescrito pelo seu médico. O GeoAI acompanha as datas e lembra você.</p><button className="button primary" onClick={()=>newProtocol(a)}><Plus size={16}/>Novo protocolo</button></div>
  {a.state.trtProtocols.length?<div className="cards-grid">{a.state.trtProtocols.map(p=>{const st=protocolStatus(p,a.state.trtDoses,a.today),score=punctuality(p,a.state.trtDoses,a.today);return <article className="panel record-card" key={p.id}>
   <div className="record-head"><span className={p.status==='active'?'pill green':'pill'}>{p.status==='active'?'Ativo':'Pausado'}</span>{p.remind&&<span className="pill">Lembrete no Telegram</span>}<div className="record-actions"><button className="icon-button" aria-label={'Editar '+p.title} onClick={()=>a.edit('trtProtocols',p)}><Pencil size={15}/></button><button className="icon-button danger" aria-label={'Excluir '+p.title} onClick={()=>a.remove('trtProtocols',p)}><Trash2 size={15}/></button></div></div>
   <button className="record-title" onClick={()=>a.edit('trtProtocols',p)}>{p.title} · {String(p.dose).replace('.',',')} {p.unit}</button>
   <p className="record-content">A cada {p.intervalDays} dias, desde {dayLabel(p.startDate)}{p.doctor?' · '+p.doctor:''}</p>
   {p.status==='active'&&<><p className="record-content"><CalendarDays size={13}/> Próxima: {dayLabel(st.next)}{st.overdue?' (atrasada há '+plural(st.overdue)+')':''}{score!==null?' · Pontualidade em 90 dias: '+score+'%':''}</p><button className="button outline small" onClick={()=>registerDose(a,p)}><Syringe size={15}/>Registrar aplicação</button></>}
  </article>;})}</div>
  :<section className="panel"><Empty icon={Syringe} title="Nenhum protocolo registrado" description="Cadastre o protocolo prescrito para acompanhar aplicações e receber lembretes." action="Novo protocolo" onAction={()=>newProtocol(a)}/></section>}
  <div className="section-action"><h2>Aplicações</h2></div>
  <Records collection="trtDoses" items={doses} compact renderExtra={d=>{const unit=a.state.trtProtocols.find(p=>p.id===d.protocolId)?.unit;const text=[d.dose?d.dose+(unit?' '+unit:''):'',d.site||''].filter(Boolean).join(' · ');return text?<p className="record-content">{text}</p>:null;}} emptyTitle="Nenhuma aplicação registrada" emptyText="Registre cada aplicação para acompanhar a pontualidade."/>
 </>;}

function TipsPanel(){const a=useApp();const last=a.state.labExams.filter(e=>e.status==='reviewed'&&e.review?.tips?.length).sort((x,y)=>y.date.localeCompare(x.date))[0];const onProtocol=a.state.trtProtocols.some(p=>p.status==='active');
 return <>
  {last&&<section className="panel"><header className="section-heading"><h2><Sparkles size={18}/> Para você</h2><span className="pill">Exame de {dayLabel(last.date)}</span></header><ul className="review-list">{(last.review.tips as string[]).map((t,i)=><li key={i}>{t}</li>)}</ul></section>}
  {onProtocol&&<p className="quiet-copy">Os hábitos complementam o tratamento, não o substituem.</p>}
  <div className="tips-grid">{TIPS.map(t=>{const Icon=ICONS[t.icon];return <section className="panel" key={t.title}><header className="section-heading"><h2><Icon size={18}/> {t.title}</h2></header><ul>{t.items.map(x=><li key={x}>{x}</li>)}</ul></section>;})}</div>
 </>;}

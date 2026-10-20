'use client';
import {useState} from 'react';import {ChevronLeft,ChevronRight,CircleHelp,Droplet,NotebookPen,Heart,Pill} from 'lucide-react';
import {useApp} from './context';import {MOODS} from './health';
import {cycleCalendar,calendarMonth,shiftMonth,durationLabel,FLOW_LABEL,type CalendarDay,type CalendarMethod} from '@/lib/female-health';
// Calendário da aba Ciclo: mês com o painel do dia e ano com 12 mini-meses. O que cada dia mostra vem de cycleCalendar.
const WEEK=['S','T','Q','Q','S','S','D'];
const fmt=(d:string,o:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('pt-BR',{...o,timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
const cap=(t:string)=>t.charAt(0).toUpperCase()+t.slice(1);
const monthTitle=(m:string)=>cap(fmt(m+'-01',{month:'long',year:'numeric'}));
const shortDate=(d:string)=>d.slice(8)+'/'+d.slice(5,7);
const plural=(n:number)=>n+(n===1?' dia':' dias');
const PHASE:Record<string,string>={menstrual:'Fase menstrual',folicular:'Fase folicular','ovulatória':'Fase ovulatória','lútea':'Fase lútea'};
// A menstruação vence na cor quando cai na janela fértil.
const tone=(d:CalendarDay)=>d.period==='logged'?'period':d.period==='predicted'?'predicted':d.ovulation?'ovulation':d.fertile?'fertile':'';
const usedMethod=(d:CalendarDay)=>d.methods.some(m=>m.method!=='iud'&&m.taken);
function methodText(m:CalendarMethod,date:string,today:string){
 if(m.method==='daily')return m.taken?'tomada':m.active?(date<=today?'não registrada':'dia '+m.packDay+' da cartela'):m.pauseUntil?'pausa até '+shortDate(m.pauseUntil):'';
 if(m.method==='injection')return m.taken?'aplicada':'prevista';
 return m.change?'troca prevista':m.daysLeft<0?'troca atrasada':'troca em '+durationLabel(m.daysLeft);}
function dayAria(d:CalendarDay){const mood=MOODS.find(x=>x.value===d.mood);
 return [fmt(d.date,{day:'numeric',month:'long'}),d.cycleDay!==null?'dia do ciclo '+d.cycleDay:'',d.period==='logged'?'menstruação registrada':d.period==='predicted'?'menstruação prevista':'',d.ovulation?'ovulação estimada':d.fertile?'janela fértil estimada':'',mood?'humor '+mood.label:'',d.symptoms.length?'sintomas':'',usedMethod(d)?'anticoncepcional':'',d.intimacy?'relação':''].filter(Boolean).join(', ');}

export function CycleCalendar(){const a=useApp();const [view,setView]=useState('mes'),[month,setMonth]=useState(a.today.slice(0,7)),[selected,setSelected]=useState(a.today),[legend,setLegend]=useState(false);
 const year=month.slice(0,4),{lead,days:dates}=calendarMonth(month);
 const days=view==='ano'?cycleCalendar(a.state,year+'-01-01',year+'-12-31',a.today):cycleCalendar(a.state,dates[0],dates[dates.length-1],a.today);
 const day=cycleCalendar(a.state,selected,selected,a.today)[0],away=view!=='mes'||month!==a.today.slice(0,7)||selected!==a.today;
 const step=(n:number)=>setMonth(shiftMonth(month,view==='ano'?12*n:n));
 return <section className="panel cycle-cal">
  <header className="cc-head">
   <div className="cc-nav"><button className="icon-button" aria-label={view==='ano'?'Ano anterior':'Mês anterior'} onClick={()=>step(-1)}><ChevronLeft size={18}/></button><h2>{view==='ano'?year:monthTitle(month)}</h2><button className="icon-button" aria-label={view==='ano'?'Próximo ano':'Próximo mês'} onClick={()=>step(1)}><ChevronRight size={18}/></button></div>
   <div className="cc-tools">{away&&<button className="button outline small" onClick={()=>{setView('mes');setMonth(a.today.slice(0,7));setSelected(a.today);}}>Hoje</button>}
    <div className="cc-switch" role="group" aria-label="Visão do calendário">{[['mes','Mês'],['ano','Ano']].map(([id,label])=><button key={id} className={view===id?'active':''} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</div>
    <button className="icon-button" aria-label="Legenda" aria-expanded={legend} onClick={()=>setLegend(!legend)}><CircleHelp size={18}/></button></div>
  </header>
  {legend&&<Legend/>}
  {!a.state.periods.some(p=>p.date<=a.today)&&<p className="cc-hint">Registre o início da última menstruação para ver as previsões.</p>}
  {view==='mes'?<><div className="cc-week" aria-hidden="true">{WEEK.map((w,i)=><span key={i}>{w}</span>)}</div>
   <div className="cc-grid">{Array.from({length:lead},(_,i)=><span key={'b'+i} className="cc-blank"/>)}{days.map(d=><DayCell key={d.date} d={d} today={a.today} selected={d.date===selected} onPick={setSelected}/>)}</div>
   {day&&<DayPanel d={day}/>}</>
  :<YearView year={year} days={days} today={a.today} onMonth={m=>{setMonth(m);setView('mes');}}/>}
 </section>;}

function DayCell({d,today,selected,onPick}:{d:CalendarDay;today:string;selected:boolean;onPick:(date:string)=>void}){const mood=MOODS.find(x=>x.value===d.mood),Mood=mood?.icon;
 return <button className={['cc-day',tone(d),d.date===today?'today':'',selected?'selected':''].filter(Boolean).join(' ')} aria-pressed={selected} aria-label={dayAria(d)} onClick={()=>onPick(d.date)}>
  <strong>{Number(d.date.slice(8))}</strong>{d.cycleDay!==null&&<small>{d.cycleDay}</small>}
  <span className="cc-marks">{Mood?<Mood size={11} color={mood?.color}/>:d.symptoms.length?<i className="cc-dot"/>:null}{usedMethod(d)&&<Pill size={11}/>}{d.intimacy&&<Heart size={11}/>}</span></button>;}

function DayPanel({d}:{d:CalendarDay}){const a=useApp();const mood=MOODS.find(x=>x.value===d.mood);
 const lines=[d.period==='logged'?'Menstruação · '+d.periodDay+'º dia'+(d.flow?' · fluxo '+(FLOW_LABEL[d.flow]||d.flow).toLowerCase():''):d.period==='predicted'?'Menstruação prevista · '+d.periodDay+'º dia':d.late?'Menstruação atrasada há '+plural(d.late):'',
  d.ovulation?'Ovulação estimada':d.fertile?'Janela fértil estimada':'',mood?'Humor: '+mood.label:'',d.symptoms.length?'Sintomas: '+d.symptoms.join(', '):'',d.notes||'',
  ...d.methods.map(m=>{const t=methodText(m,d.date,a.today);return t?m.title+': '+t:'';}),
  d.intimacy?(d.intimacy.protection==='com'?'Relação com proteção':d.intimacy.protection==='sem'?'Relação sem proteção':'Relação')+(d.intimacy.notes?' · '+d.intimacy.notes:''):''].filter(Boolean);
 // Botões só até hoje: não se registra menstruação, anotação ou relação no futuro.
 const past=d.date<=a.today,current=d.period==='logged'?a.state.periods.filter(p=>p.date<=d.date).sort((x,y)=>y.date.localeCompare(x.date))[0]:undefined;
 const sym=a.state.symptoms.find(x=>x.date===d.date),rel=a.state.intimacy.find(x=>x.date===d.date);
 return <div className="cc-panel"><header><h3>{cap(fmt(d.date,{weekday:'long',day:'numeric',month:'long'}))}</h3><div className="cc-pills">{d.cycleDay!==null&&<span className="pill">Dia do ciclo {d.cycleDay}</span>}{d.phase&&<span className="pill">{PHASE[d.phase]}</span>}</div></header>
  {lines.length?<ul>{lines.map((l,i)=><li key={i}>{l}</li>)}</ul>:<p className="cc-empty">Nada registrado neste dia.</p>}
  {past&&<div className="button-group">
   <button className="button outline small" disabled={a.busy} onClick={()=>current?a.edit('periods',current):a.edit('periods',undefined,{date:d.date,title:'Menstruação',flow:'moderado'})}><Droplet size={15}/>{current?'Editar menstruação':'Menstruação começou'}</button>
   <button className="button outline small" disabled={a.busy} onClick={()=>sym?a.edit('symptoms',sym):a.edit('symptoms',undefined,{date:d.date,title:'Sintomas do dia',symptoms:[]})}><NotebookPen size={15}/>Anotações</button>
   <button className="button outline small" disabled={a.busy} onClick={()=>rel?a.edit('intimacy',rel):a.edit('intimacy',undefined,{date:d.date,title:'Relação'})}><Heart size={15}/>Relação</button></div>}
 </div>;}

function Legend(){return <ul className="cc-legend">{[['period','Menstruação'],['predicted','Menstruação prevista'],['fertile','Janela fértil estimada'],['ovulation','Ovulação estimada']].map(([c,l])=><li key={c}><i className={'cc-swatch '+c}/>{l}</li>)}
 <li><i className="cc-dot"/>Humor ou sintomas</li><li><Pill size={12}/>Anticoncepcional</li><li><Heart size={12}/>Relação</li></ul>;}

function YearView({year,days,today,onMonth}:{year:string;days:CalendarDay[];today:string;onMonth:(m:string)=>void}){const map=new Map(days.map(d=>[d.date,d]));
 return <div className="cc-year">{Array.from({length:12},(_,i)=>{const m=year+'-'+String(i+1).padStart(2,'0'),{lead,days:dates}=calendarMonth(m);
  return <button key={m} className="cc-mini" aria-label={'Abrir '+monthTitle(m)} onClick={()=>onMonth(m)}><h3>{cap(fmt(m+'-01',{month:'long'}))}</h3>
   <div className="cc-mini-grid">{Array.from({length:lead},(_,k)=><i key={'b'+k} className="blank"/>)}{dates.map(date=>{const d=map.get(date);return <i key={date} className={[d?tone(d):'',date===today?'today':''].filter(Boolean).join(' ')}/>;})}</div></button>;})}</div>;}

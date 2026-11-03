'use client';
import {useEffect,useState} from 'react';
import {Trophy,Flame,Clock,Dumbbell,Layers,LoaderCircle} from 'lucide-react';
import {fmtWeight,toUnit,fmtNumber,shiftDate} from '@/lib/gym';
import {exerciseOf,MUSCLES} from '@/lib/gym-catalog';
import {totals,weekStreak} from '@/lib/gym-stats';
import {heatmap,seriesOf,frequentExercises,doneByMuscle,plannedByMuscle,effortSummary,recordTimeline,bestWeekStreak,SET_RANGE} from '@/lib/gym-insights';
import {levelFrom} from '@/lib/gym-muscles';
import {Stat} from './primitives';
import {useApp} from './context';
import {useGym} from './gym-context';
import {BodyMap} from './gym-body';
import {Segmented,fmtDate,fmtMinutes,fmtVolume,fmtSecs,plural} from './gym-ui';
type Metric='e1rm'|'top'|'volume';

export function StatsTab({onOpen}:{onOpen:(id:string)=>void}){const g=useGym(),app=useApp(),view=g.view!,p=view.profile,unit=p.settings.unit;
 // As estatísticas leem o histórico inteiro: busca as páginas que faltam ao abrir a aba.
 useEffect(()=>{if(g.full)return;const t=setTimeout(()=>{g.loadAll();},0);return()=>clearTimeout(t);},[g]);
 const w=view.workouts,t=totals(w,g.today),dates=w.map(x=>x.date);
 const [heatBy,setHeatBy]=useState<'minutes'|'volume'>('minutes'),[mode,setMode]=useState<'done'|'planned'>('done'),[metric,setMetric]=useState<Metric>('e1rm');
 const freq=frequentExercises(w);const [picked,setPicked]=useState<string>('');const exId=picked||freq[0]?.id||'';
 const heat=heatmap(w,g.today,p.schedule.weekStart);
 const series=exId?seriesOf(w,exId):[],ex=exerciseOf(exId,p.custom);
 const since=shiftDate(g.today,-28),muscles=mode==='done'?doneByMuscle(w,since,g.today,p.custom):plannedByMuscle(p);
 const effort=effortSummary(w,shiftDate(g.today,-90)),records=recordTimeline(w).slice(0,8);
 if(!w.length)return <section className="panel gy-empty"><p>As estatísticas aparecem depois do primeiro treino finalizado.</p></section>;
 const rows=Object.entries(muscles).filter(([m])=>MUSCLES[m]).sort((a,b)=>b[1]-a[1]);
 return <>
  {!g.full&&<p className="gy-count" role="status"><LoaderCircle size={13} className="spin"/> Carregando o histórico completo…</p>}
  <div className="stats-grid four gy-stats"><Stat label="Treinos" value={t.workouts} icon={Dumbbell} foot={t.month+' neste mês'}/><Stat label="Total levantado" value={fmtVolume(t.volume,unit)} icon={Layers} foot={plural(t.sets,'série','séries')}/><Stat label="Tempo treinando" value={fmtMinutes(t.minutes)} icon={Clock} foot={t.workouts?'média de '+fmtMinutes(Math.round(t.minutes/t.workouts)):''}/><Stat label="Semanas seguidas" value={weekStreak(dates,g.today,p.schedule.weekStart)} icon={Flame} foot={'melhor: '+bestWeekStreak(dates,p.schedule.weekStart)}/></div>
  <section className="panel gy-panel"><header className="gy-panel-head"><h2>Atividade nos últimos 12 meses</h2><Segmented label="Medir por" value={heatBy} onChange={setHeatBy} options={[['minutes','Tempo'],['volume','Volume']]}/></header>
   <div className="gy-heat" role="img" aria-label={plural(w.filter(x=>x.date>=heat.cols[0][0].date).length,'treino','treinos')+' nos últimos 12 meses'}>{heat.cols.map((col,i)=><div key={i}>{col.map(d=>{const v=heatBy==='minutes'?d.minutes/heat.max.minutes:d.volume/heat.max.volume;return <i key={d.date} className={d.future?'future':d.count?'on':''} style={d.count?{['--lv' as string]:Math.round(30+v*70)+'%'}:undefined} title={fmtDate(d.date)+(d.count?' · '+plural(d.count,'treino','treinos')+' · '+fmtMinutes(d.minutes)+' · '+fmtVolume(d.volume,unit):'')}/>;})}</div>)}</div>
   <p className="gy-heat-legend"><span>Menos</span><i/><i style={{['--lv' as string]:'55%'}} className="on"/><i style={{['--lv' as string]:'100%'}} className="on"/><span>Mais</span></p></section>
  {exId&&<section className="panel gy-panel"><header className="gy-panel-head"><h2>Evolução</h2><select aria-label="Exercício" value={exId} onChange={e=>setPicked(e.target.value)}>{freq.slice(0,40).map(f=><option key={f.id} value={f.id}>{exerciseOf(f.id,p.custom)?.name||f.id} ({f.count})</option>)}</select></header>
   <Segmented label="Mostrar" value={metric} onChange={setMetric} options={[['e1rm','1RM estimado'],['top','Carga máxima'],['volume','Volume']]}/>
   <LineChart points={series.map(s=>({date:s.date,value:metric==='e1rm'?s.e1rm:metric==='top'?s.top:s.volume,effort:s.effort}))} format={v=>metric==='volume'?fmtVolume(v,unit):fmtWeight(v,unit)}/>
   {series.length>0&&<p className="quiet-copy">{ex?.name}: {series.length} treinos. Melhor 1RM estimado {fmtWeight(Math.max(...series.map(s=>s.e1rm)),unit)}. O ponto mais cheio indica menos reps sobrando (RIR menor).</p>}
   <ul className="gy-history-mini">{series.slice(-6).reverse().map(s=><li key={s.date}><time>{fmtDate(s.date)}</time><span>{s.top?fmtNumber(toUnit(s.top,unit),1)+' '+unit+' × '+s.reps:s.timeSec?fmtSecs(s.timeSec):s.reps+' reps'}</span><small>{s.effort!==null?'RIR '+fmtNumber(s.effort):''}</small></li>)}</ul></section>}
  <section className="panel gy-panel"><header className="gy-panel-head"><h2>Músculos</h2><Segmented label="Séries" value={mode} onChange={setMode} options={[['done','Feitas (4 semanas)'],['planned','Planejadas']]}/></header>
   <p className="quiet-copy">{mode==='done'?'Média de séries por semana nas últimas 4 semanas.':'Séries por semana que o seu plano prevê.'} Muita gente usa {SET_RANGE[0]} a {SET_RANGE[1]} séries por semana por músculo como referência.</p>
   <div className="gy-muscles"><BodyMap level={levelFrom(muscles)} gender={app.state.profile.gender} size="lg" label="Mapa dos músculos trabalhados"/>
    <ul>{rows.map(([m,v])=><li key={m}><span>{MUSCLES[m]}</span><div className="gy-bar" aria-hidden><span style={{width:Math.min(100,v/SET_RANGE[1]*100)+'%'}} className={v<SET_RANGE[0]?'low':v>SET_RANGE[1]?'high':''}/><i style={{left:SET_RANGE[0]/SET_RANGE[1]*100+'%'}}/></div><b>{fmtNumber(v)}</b></li>)}{!rows.length&&<li className="quiet-copy">Nada nesse período.</li>}</ul></div></section>
  {p.settings.effort!=='off'&&effort.rated>0&&<section className="panel gy-panel"><header className="gy-panel-head"><h2>Esforço · 90 dias</h2></header>
   <div className="gy-summary"><div><small>RIR médio</small><strong>{fmtNumber(effort.avg??0)}</strong></div><div><small>A 3 reps ou menos da falha</small><strong>{effort.hard}%</strong></div><div><small>Séries avaliadas</small><strong>{effort.rated} de {effort.total}</strong></div></div>
   <ul className="gy-effort-dist">{effort.buckets.map(([l,c],i)=><li key={l}><span>RIR {l}</span><div className="gy-bar" aria-hidden><span className={'t'+i} style={{width:(c/Math.max(1,...effort.buckets.map(b=>b[1])))*100+'%'}}/></div><b>{c}</b></li>)}</ul></section>}
  {records.length>0&&<section className="panel gy-panel"><header className="gy-panel-head"><h2>Recordes recentes</h2></header><ul className="gy-records-list">{records.map(r=><li key={r.workoutId+r.exerciseId}><button onClick={()=>onOpen(r.workoutId)}><Trophy size={15}/><span><strong>{exerciseOf(r.exerciseId,p.custom)?.name}</strong><small>{fmtDate(r.date)}</small></span><b>{r.weight?fmtWeight(r.weight,unit)+' × '+r.reps:r.timeSec?fmtSecs(r.timeSec):r.reps+' reps'}</b></button></li>)}</ul></section>}
 </>;}

// Linha simples em SVG: pontos por treino; o ponto é mais cheio quanto menos reps sobravam.
function LineChart({points,format}:{points:{date:string;value:number;effort:number|null}[];format:(v:number)=>string}){const data=points.filter(p=>p.value>0);
 if(data.length<2)return <p className="quiet-copy gy-chart-empty">Faça este exercício mais uma vez para ver a linha.</p>;
 const W=640,H=200,P=28,min=Math.min(...data.map(d=>d.value)),max=Math.max(...data.map(d=>d.value)),span=max-min||1;
 const x=(i:number)=>P+i*(W-2*P)/(data.length-1),y=(v:number)=>H-P-(v-min)/span*(H-2*P);
 return <figure className="gy-chart"><svg viewBox={'0 0 '+W+' '+H} role="img" aria-label={'De '+format(data[0].value)+' a '+format(data[data.length-1].value)}>
  <line x1={P} x2={W-P} y1={y(max)} y2={y(max)} className="grid"/><line x1={P} x2={W-P} y1={y(min)} y2={y(min)} className="grid"/>
  <text x={P} y={y(max)-6} className="lbl">{format(max)}</text><text x={P} y={y(min)+14} className="lbl">{format(min)}</text>
  <polyline points={data.map((d,i)=>x(i)+','+y(d.value)).join(' ')} className="line"/>
  {data.map((d,i)=><circle key={i} cx={x(i)} cy={y(d.value)} r={5} className={'pt'+(d.effort!==null&&d.effort<=1?' full':d.effort!==null&&d.effort<=3?' half':'')}><title>{fmtDate(d.date)+': '+format(d.value)}</title></circle>)}
 </svg><figcaption><span>{fmtDate(data[0].date,{day:'numeric',month:'short'})}</span><span>{fmtDate(data[data.length-1].date,{day:'numeric',month:'short'})}</span></figcaption></figure>;}

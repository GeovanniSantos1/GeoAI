'use client';
import {useEffect,useState} from 'react';import {ChevronLeft,ChevronRight} from 'lucide-react';
import {useApp} from './context';import {useFoco} from './focus-context';import {Stat,Empty} from './primitives';import {foco} from './focus-api';import {ddmm} from './focus-ui';
import {weekRange,focusReport,formatMinutes} from '@/lib/focus-report';import type {CardSummary} from '@/lib/board';
// Relatório semanal: só os focos concluídos contam; os arquivados entram para não virarem "Card excluído".
const DAYS=['seg','ter','qua','qui','sex','sáb','dom'];
export function FocusReportTab(){const a=useApp(),f=useFoco();const [offset,setOffset]=useState(0),[archived,setArchived]=useState<CardSummary[]>([]);
 useEffect(()=>{foco.board(true).then(r=>setArchived(r.cards)).catch(()=>{});},[]);
 const w=weekRange(a.today,offset),r=focusReport(a.state.focusSessions,[...f.cards,...archived],w.start,w.days[6]),max=Math.max(1,...r.byDay.map(d=>d.pomodoros));
 return <><div className="fo-week"><button className="button ghost small" onClick={()=>setOffset(o=>o-1)}><ChevronLeft size={15}/>Anterior</button><button className="button ghost small" disabled={offset===0} onClick={()=>setOffset(0)}>Esta semana</button>
   <button className="button ghost small" disabled={offset===0} onClick={()=>setOffset(o=>Math.min(0,o+1))}>Próxima<ChevronRight size={15}/></button><b>{ddmm(w.start)} a {ddmm(w.end)}</b></div>
  <div className="stats-grid three"><Stat label="Pomodoros concluídos" value={r.total}/><Stat label="Tempo de foco" value={formatMinutes(r.minutes)}/><Stat label="Interrompidos" value={r.interrupted}/></div>
  {r.total||r.interrupted?<><section className="panel"><header className="section-heading"><h2>Por dia</h2></header><div className="fo-bars">{r.byDay.map((d,i)=><div key={d.date} className="fo-bar" title={d.minutes+' min'}><span>{d.pomodoros||''}</span><div><i style={{height:d.pomodoros/max*100+'%'}}/></div><small>{DAYS[i]}</small></div>)}</div></section>
   {r.byCard.length>0&&<section className="panel"><header className="section-heading"><h2>Por card</h2></header><div className="fo-changes-wrap"><table className="fo-table"><thead><tr><th>Card</th><th>🍅</th><th>Estimado</th></tr></thead><tbody>{r.byCard.map(x=><tr key={x.cardId||'livre'}><td>{x.code&&<b>{x.code} </b>}{x.title}</td><td>{x.pomodoros}</td><td>{x.estimated??'—'}</td></tr>)}</tbody></table></div></section>}</>
  :<Empty title="Semana sem pomodoros" description="Nenhum pomodoro nesta semana."/>}</>;}
